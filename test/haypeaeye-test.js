var assert = require("assert");
var haypeaeye = require("../haypeaeye");


describe('Haypeaeye', function(){
    describe('Check getAttribute()', function(){
        it('should retrieve a GET attribute', function(){
            var attributeValue = haypeaeye.getAttribute({params: {test: "hello query"}}, "test", "GET");
            assert.equal("hello query", attributeValue);
        })
        it('should retrieve a POST attribute', function(){
            var attributeValue = haypeaeye.getAttribute({body: {test: "hello body"}}, "test", "POST");
            assert.equal("hello body", attributeValue);
        })
    })

    describe('Add and call API Methods', function() {
        it("should add a new api method and check that it is called", function() {
            haypeaeye.addApiMethod(
                "/api/test/hello", haypeaeye.GET,
                "Tests hello world",
                {grouping: "Tests", auth: haypeaeye.AUTH_NOT_REQUIRED},
                [{name: "who", type: haypeaeye.String, required: true, description: "Who to say hello to"}],
                function(req, res) {
                    res.json({status: "ok", hello: req.query.who});
                }
            );

            haypeaeye.handleRequest({method: "GET", path: "/api/test/hello", query: {who: "world"}}, {json: function(obj) {
                assert.equal(obj.status, "ok");
                assert.equal(obj.hello, "world", "Hello parameter not picked up");
            }});

        })

        it("should check that required parameters are required", function() {
            haypeaeye.handleRequest({method: "GET", path: "/api/test/hello", query: {}}, {send: function(error, msg) {
                assert.equal(error, 400);
                assert.equal(msg.error, "Required attribute not present, 'who'");
            }});
        })

        it("should check numeric validation", function() {
            haypeaeye.addApiMethod(
                "/api/test/numbers", haypeaeye.GET,
                "Tests numbers",
                {grouping: "Tests", auth: haypeaeye.AUTH_NOT_REQUIRED},
                [{name: "number", type: haypeaeye.Number, required: true, description: "Number value"}],
                function(req, res) {
                    res.json({status: "ok", number: req.query.number});
                }
            );

            haypeaeye.handleRequest({method: "GET", path: "/api/test/numbers", query: {number: "blah"}}, {send: function(error, msg) {
                assert.equal(error, 400);
                assert.equal(msg.error, "Attribute 'number' is not a valid number");
            }});

            // Check whole numbers
            haypeaeye.handleRequest({method: "GET", path: "/api/test/numbers", query: {number: 20}}, {json: function(msg) {
                assert.equal(msg.status, "ok");
            }});

            // Check decimal numbers
            haypeaeye.handleRequest({method: "GET", path: "/api/test/numbers", query: {number: 20.5}}, {json: function(msg) {
                assert.equal(msg.status, "ok");
            }});
        })

    })



})
