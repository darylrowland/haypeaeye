// Haypeaeye automated testing module
// Tests that all of your API endpoints

var haypeaeye = require("haypeaeye");
var requestLib = require("request");
var request = requestLib.defaults({jar: true});
var fs = require("fs");
var path = require("path");

const REQUEST_TIMEOUT = 2000;

exports.TEST_OUTPUT_FILE = path.join(__dirname, "../../tests/test-results.json");
exports.TEST_EXAMPLES_FILE = path.join(__dirname, "../../tests/haypeaeye-examples.json");

var testResults = [];
var exampleResults = {};
var numberPassed = 0;
var totalTests = 0;

// Stores values created during tests that need to be used later on in other tests
var storedValues = {};

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

/*
    Checks if the field matches the expected value
    Returns an object like this:
    {
        matches: false,
        expected: "Blah",
        found: "Blahs"
    }
 */
var doesFieldMatch = function(resultObj, checkField, expectedValue) {
    // Split any .'s out
    var fieldHierachy = checkField.split(".");

    var obj = resultObj[fieldHierachy[0]];

    if (!obj) {
        return {
            matches: false,
            expected: expectedValue,
            found: "[Missing object " + fieldHierachy[0] + "]"
        };
    }

    for (var i = 1; i < fieldHierachy.length; i++) {

        if (obj[fieldHierachy[i]]) {
            obj = obj[fieldHierachy[i]];
        } else {
            return {
                matches: false,
                expected: expectedValue,
                found: "[Missing object " + fieldHierachy[i - 1] + "]"
            };
        }
    }



    if (!obj) {
        return {
            matches: false,
            expected: expectedValue,
            found: "[Missing value]"
        };
    } else {
        // We have the object, check it
        return {
            matches: obj === expectedValue,
            expected: expectedValue,
            found: obj
        };

    }


}

var storeValue = function(resultObj, storeKey, fieldPath) {
    // Split any .'s out
    var fieldHierachy = fieldPath.split(".");

    var obj = resultObj[fieldHierachy[0]];

    if (!obj) {
        console.log("Could not STORE " + storeKey + " [Missing object " + fieldHierachy[0] + "]");
        return;
    }

    for (var i = 1; i < fieldHierachy.length; i++) {

        if (obj[fieldHierachy[i]]) {
            obj = obj[fieldHierachy[i]];
        } else {
            console.log("Could not STORE " + storeKey + " [Missing object " + fieldHierachy[i - 1]  + "]");
            return;
        }
    }

    if (!obj) {
        console.log("Could not STORE " + storeKey + " [Missing Value]");
    } else {
        // We have the object, check it
        storedValues[storeKey] = obj;
        console.log("STORED " + storeKey + " as " + obj);
    }
}

/**
 * Convert any STORED parameters, e.g. !!NAME!! to their actual values
 */
var parseTestUrl = function(url) {
    var currentUrl = url;

    while(currentUrl.indexOf("!!") >= 0) {
        var startIndex = currentUrl.indexOf("!!");
        var endIndex = currentUrl.length;

        // Figure out what the param is
        var param = "";

        for (var i = startIndex + 2; i < currentUrl.length; i++) {
            if (currentUrl.charAt(i) != "!") {
                param += currentUrl.charAt(i);
            } else {
                endIndex = i;
                break;
            }
        }

        var value = param;


        if (storedValues[param]) {
            value = storedValues[param];
        } else {
            console.log("Could not find STORED value for " + param);
        }

        currentUrl = currentUrl.substr(0, startIndex) + value + currentUrl.substr(endIndex + 2);
    }

    return currentUrl;
}

var checkResponseAgainstTest = function(test, error, response, body, failedReasons, callback) {
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
            // If the user has specified a match model, check it here
            if (test.check) {
                // We have to check whether certain fields match or not
                var responseData = {};

                // If we have a .data field, use that, otherwise use the top level json to check/compare
                if (body.data) {
                    responseData = body.data;
                } else {
                    responseData = body;
                }

                for (checkField in test.check) {
                    var matchResult = doesFieldMatch(responseData, checkField, test.check[checkField]);
                    if (!matchResult.matches) {
                        // Doesn't match, add as a failure reason
                        failedReasons.push(checkField + " does not match " + test.check[checkField] + ". Instead found " + matchResult.found);
                    }
                }
            }


        }
    }

    if (failedReasons.length == 0) {
        numberPassed ++;
    }

    // Store any values needed for the next test
    if (test.store) {
        var responseData = {};

        if (body.data) {
            responseData = body.data;
        } else {
            responseData = body;
        }

        for(var storeKey in test.store) {
            storeValue(responseData, storeKey, test.store[storeKey]);
        }
    }

    var responseStatusCode = null;

    if (response && response.statusCode) {
        responseStatusCode = response.statusCode;
    }

    dealWithTestResponse(test, responseStatusCode, body, failedReasons, function() {
        callback();
    });
}

var replaceTestParamsWithStoredValues = function(test) {
    if (test.params) {
        for (testParam in test.params) {
            if (test.params[testParam].indexOf("!!") == 0) {
                var storedValueKey =  test.params[testParam].substr(2, test.params[testParam].lastIndexOf("!!") - 2);

                if (!storedValues[storedValueKey]) {
                    console.log("Could not find STORED value for " + storedValueKey);
                } else {
                    test.params[testParam] = storedValues[storedValueKey];
                }


            }
        }
    }
}

var callTest = function(host, test, callback) {
    totalTests++;

    replaceTestParamsWithStoredValues(test);

    var failedReasons = [];

    if (test.method && test.method == "POST") {
        // POST REQUEST
        var options =  {
            uri: host + parseTestUrl(test.url),
            timeout: REQUEST_TIMEOUT,
            json: test.params
        };

        request.post(options, function (error, response, body) {
            checkResponseAgainstTest(test, error, response, body, failedReasons, function() {
                callback();
            });
        });
    } else if (test.method && test.method == "DELETE") {
        // DELETE REQUEST
        var options = {
            uri: host + parseTestUrl(test.url),
            timeout: REQUEST_TIMEOUT,
            json: test.params
        };

        request.delete(options, function (error, response, body) {
            checkResponseAgainstTest(test, error, response, body, failedReasons, function () {
                callback();
            });
        });
    } else if (test.method && test.method == "PUT") {
        // PUT REQUEST
        var options =  {
            uri: host + parseTestUrl(test.url),
            timeout: REQUEST_TIMEOUT,
            json: test.params
        };

        request.put(options, function (error, response, body) {
            checkResponseAgainstTest(test, error, response, body, failedReasons, function() {
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
            uri: host + parseTestUrl(test.url) + getParams,
            timeout: REQUEST_TIMEOUT
        };

        request.get(options, function (error, response, body) {
            checkResponseAgainstTest(test, error, response, body, failedReasons, function() {
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

exports.getStoredValues = function() {
    return storedValues;
}
