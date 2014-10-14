// Haypeaeye automated testing module
// Tests that all of your API endpoints

var haypeaeye = require("haypeaeye");
var request = require("request");
var fs = require("fs");
var path = require("path");

const REQUEST_TIMEOUT = 2000;

exports.TEST_OUTPUT_FILE = path.join(__dirname, "../../tests/test-results.json");
exports.TEST_EXAMPLES_FILE = path.join(__dirname, "../../tests/haypeaeye-examples.json");

var testResults = [];
var exampleResults = {};
var numberPassed = 0;
var totalTests = 0;

var dealWithTestResponse = function(test, responseCode, body, failedReasons, callback) {
    if (failedReasons.length == 0) {
        testResults.push({
            test: test,
            result: "pass"
        });

        if (!exampleResults[test.method + "_" + test.url]) {
            exampleResults[test.method + "_" + test.url] = [];
        }

        exampleResults[test.method + "_" + test.url].push({
            title: test.title,
            params: test.params,
            result: body,
            response_code: responseCode
        });


    } else {
        testResults.push({
            test: test,
            result: "fail",
            failed_reasons: failedReasons
        });
    }

    callback();
}


var callBeforeForTest = function(host, test, callback) {

}

var callTest = function(host, test, callback) {
    totalTests++;

    var failedReasons = [];

    if (test.method && test.method == "POST") {
        // POST REQUEST
        var options =  {
            uri: host + test.url,
            timeout: REQUEST_TIMEOUT,
            json: test.params
        };

        request.post(options, function (error, response, body) {
            if (error) {
                failedReasons.push(error);
            } else {
                if (response.statusCode != test.responseCode) {
                    failedReasons.push("Invalid response code. Expected: " + test.responseCode + " Got: " +  response.statusCode);
                } else {
                    // Check the response is as we expect
                }
            }

            if (failedReasons.length == 0) {
                numberPassed ++;
            }

            dealWithTestResponse(test, response.statusCode, body, failedReasons, function() {
                callback();
            });

        });
    } else if (test.method && test.method == "GET") {
        // Compile get request
        var getParams = "?";

        for (var key in test.params) {
            if (getParams.length < 2) {
                getParams += "&";
            }

            getParams += key + "=" + test.params[key];
        }

        // GET REQUEST
        var options =  {
            uri: host + test.url + getParams,
            timeout: REQUEST_TIMEOUT
        };

        request.get(options, function (error, response, body) {
            if (error) {
                failedReasons.push(error);
            } else {
                if (response.statusCode != test.responseCode) {
                    failedReasons.push("Invalid response code. Expected: " + test.responseCode + " Got: " +  response.statusCode);

                    if (body.error) {
                        failedReasons.push(body.error);
                    }

                } else {
                    // Check the response is as we expect
                }
            }

            if (failedReasons.length == 0) {
                numberPassed ++;
            }

            var bodyJson = body;

            try {
                bodyJson = JSON.parse(body);
            } catch (e) {
                // Do nothing, return body
            }


            dealWithTestResponse(test, response.statusCode, bodyJson, failedReasons, function() {
                callback();
            });

        });
    }

}

var callNextTest = function(host, tests, index, callback) {
    callTest(host, tests[index], function() {
        // Once done call next test

        if (index + 1 < tests.length) {
            callNextTest(host, tests, index + 1, function() {
                callback();
            });
        } else if (index + 1 >= tests.length) {
            callback()
        }
    });
}

exports.saveResultsToFile = function(callback) {
    console.log("----------------------------------------------------");
    console.log("TESTS COMPLETED");

    var passPercentage = Math.round((numberPassed / totalTests) * 100);

    console.log(numberPassed + " out of " + totalTests + " passed (" + passPercentage + "%)");
    console.log("----------------------------------------------------");


    fs.writeFile(exports.TEST_OUTPUT_FILE, JSON.stringify(testResults, null, 4), function(err) {
        if(err) {
            console.error(err);
            callback(err);
        } else {
            console.log("Test results file saved to", exports.TEST_OUTPUT_FILE);

            console.log(JSON.stringify(exampleResults, null, 4));

            // Now save examples file
            fs.writeFile(exports.TEST_EXAMPLES_FILE, JSON.stringify(exampleResults, null, 4), function(err) {
                if(err) {
                    console.error(err);
                    callback(err);
                } else {
                    console.log("Examples file saved to", exports.TEST_EXAMPLES_FILE);
                    callback();
                }
            });

        }
    });

}

exports.runTestsFromFile = function(fileName, host, functions, callback) {
    exampleResults = {};
    testResults = [];

    try {
        var testFile = require(fileName);

        if (testFile.before) {
            if (!functions[testFile.before]) {
                console.error("Before function does not exist", testFile.before);
                return;
            }

            //
            functions[testFile.before](function() {
                // Call the first test
                callNextTest(host, testFile.tests, 0, function() {
                    exports.saveResultsToFile(function() {
                        callback();
                    });

                });
            });


        } else {
            // Call the first test
            callNextTest(host, testFile.tests, 0, function() {
                // Once we're done, save out the results
                exports.saveResultsToFile(function() {
                    callback();
                });
            });
        }


    } catch (e) {
        console.error("Could not load the haypeaeye tests metadata file", e);
    }
}
