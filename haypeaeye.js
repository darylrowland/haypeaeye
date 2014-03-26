var apiMethods = {};

exports.AUTH_REQUIRED = "required";
exports.AUTH_OPTIONAL = "optional";
exports.AUTH_NOT_REQUIRED = "notrequired";

exports.APP_TOKEN_ALWAYS_REQUIRED = "always";
exports.APP_TOKEN_NEVER_REQUIRED = "never";
exports.APP_TOKEN_PER_REQUEST_REQUIRED = "perrequest";

exports.String = "String";
exports.Number = "Number";
exports.Boolean = "Boolean";
exports.File = "File";

exports.GET = "GET";
exports.POST = "POST";
exports.PUT = "PUT";
exports.DELETE = "DELETE";

exports.DOCS_SUFFIX = ".docs";

exports.DEFAULT_APP_TOKEN_NAME = "apptoken";

var settings = {
    appTokenName: exports.DEFAULT_APP_TOKEN_NAME,
    appTokenRequired: exports.APP_TOKEN_NEVER_REQUIRED,
    authenticatorMethod: null,
    documentationUrl: "/api/docs",
    apiRoot: "/api",
    applicationName: "Your app name",
    authAttributes: [
        {name: "appToken", description: "Token given to your app", type: exports.String},
        {name: "userToken", description: "Unique token for your user", type: exports.String}
    ]
};

exports.addApiMethod = function(url, method, title, options, params, callback) {
    // Process the url, to look for embedded params
    var regExpStr = "";

    if (url.indexOf(":") >= 0) {
        var urlParams = [];

        var currentParamName = "";
        var foundParam = false;

        for (var i = 0; i < url.length; i++) {
            if (foundParam) {
                if (url.charAt(i) == "/") {
                    // Add this param to the list
                    urlParams.push(currentParamName);
                    regExpStr = regExpStr + "([^\/]*)?/";
                    currentParamName = "";
                    foundParam = false;
                } else {
                    currentParamName = currentParamName + url.charAt(i);
                }

            } else {
                if (url.charAt(i) == ':') {
                    foundParam = true;
                } else {
                    regExpStr = regExpStr + url.charAt(i);
                }
            }
        }

        // Do we have a trailing param (i.e. one at the end?)
        if (foundParam) {
            urlParams.push(currentParamName);
            regExpStr = regExpStr + "([^\/]*)?";
        }

        // Add param number mappings to params
        if (urlParams.length > 0) {
            if (!params || params.length == 0) {
                console.error("No parameters specified in API method that requires them " + url);
            }

            for (var i = 0; i < urlParams.length; i++) {
                // See if we have a match in the user defined param list
                var match = false;

                for (var x = 0; x < params.length; x++) {
                    if (params[x].name == urlParams[i]) {
                        params[x].index = i;
                        match = true;
                        break;
                    }
                }

                if (!match) {
                    console.error("You have not specified a definition for the parameter '" + urlParams[i] + "'");
                }

            }
        }

    }

    apiMethods[method + "_" + url] = {
        url: url,
        method: method,
        title: title,
        params: params,
        callback: callback,
        options: options
    };

    if (regExpStr != "") {
        apiMethods[method + "_" + url].regexp = regExpStr;
    }
};

var getAttribute = function(req, attrName, methodType) {
    if (req.params[attrName]) {
        return req.params[attrName];
    }

    if (methodType == exports.GET) {
        if (req.query[attrName] != null && req.query[attrName] != undefined) {
            return req.query[attrName];
        } else {
            return null;
        }
    } else if (methodType == exports.POST) {
        if (req.body[attrName] != null && req.body[attrName] != undefined) {
            return req.body[attrName];
        } else {
            return null;
        }
    }
}

var getValuesForParams = function(method, req) {
    var regExp = new RegExp(method.regexp, "i");
    var array = req.path.match(regExp);

    for (var i = 0; i < method.params.length; i++) {
        var param = method.params[i];

        if (param.index != undefined) {
            req.params[param.name] = array[param.index + 1];
        }
    }
}

var callMethod = function(methodToCall, req, res) {
    if (methodToCall.regexp) {
        getValuesForParams(methodToCall, req);
    }

    if (methodToCall.params && methodToCall.params.length > 0) {
        for (var i = 0; i < methodToCall.params.length; i++) {
            var param = methodToCall.params[i];

            // Is this param required?
            if ((param.required || param.index != undefined) && (!getAttribute(req, param.name, methodToCall.method))) {
                res.send(400, {error: "Required attribute not present, '" + param.name + "'"});
                return;
            }

            var rawValue = getAttribute(req, param.name, methodToCall.method);

            if (rawValue != null) {
                // Begin more detailed validations
                if (param.type && param.type == exports.Number) {
                    if (isNaN(rawValue)) {
                        res.send(400, {error: "Attribute '" + param.name + "' is not a valid number"});
                        return;
                    }
                }
            }
        }
    }

    methodToCall.callback(req, res);
}

exports.handleRequest = function(req, res, next) {
    if (req.method == exports.GET && req.url == settings.documentationUrl + "/settings") {
        res.json(settings);
    } else if (req.method == exports.GET && req.url == settings.documentationUrl) {
        var docsJson = [];

        for (var key in apiMethods) {
            docsJson.push(apiMethods[key]);
        }

        res.json(docsJson);

    }  else {
        var url = req.path;
        var showDocs = false;

        // Check if we're showing the docs
        if (url.indexOf(exports.DOCS_SUFFIX) == url.length - exports.DOCS_SUFFIX.length) {
            showDocs = true;
            url = url.substr(0, url.indexOf(exports.DOCS_SUFFIX));
        }

        var foundMethod = apiMethods[req.method + "_" + url];

        if (!foundMethod) {
            // See if we can regexp match it (i.e. there might be params in the url)
            for (var key in apiMethods) {
                if (apiMethods[key].regexp) {
                    var regexp = new RegExp(apiMethods[key].regexp, "i");

                    if (regexp.test(url)) {
                        foundMethod = apiMethods[key];
                    }
                }

            }
        }

        if (foundMethod) {
            if (showDocs) {
                // We are showing docs for this method/url
                res.json(foundMethod);
            } else {
                // We are actually running the method
                if (foundMethod.options && foundMethod.options.auth && (foundMethod.options.auth == exports.AUTH_OPTIONAL || foundMethod.options.auth == exports.AUTH_REQUIRED)) {
                    settings.authenticatorMethod(req, function(user) {
                        if (user) {
                            // We have an authed user
                            req.authUser = user;
                            callMethod(foundMethod, req, res);
                        } else if (foundMethod.options.auth == exports.AUTH_OPTIONAL) {
                            // Auth optional, so user not needed
                            callMethod(foundMethod, req, res);
                        } else {
                            // Auth required, and auth failed, so send error
                            res.send(401, {error: "Invalid login credentials"});
                        }
                    });
                } else {
                    callMethod(foundMethod, req, res);
                }
            }
        } else {
            next();
        }
    }
};

var applySetting = function(settingName, newSettings, validValues) {
    if (newSettings[settingName]) {
        if (validValues && validValues.length > 0) {
            // Need to check value is valid
            for (var i = 0; i < validValues.length; i++) {
                if (validValues[i] == newSettings[settingName]) {
                    settings[settingName] = newSettings[settingName];
                    return;
                }
            }

            // Value invalid, don't set
            console.error("Invalid value '", newSettings[settingName] ,"' for setting '", settingName, "'. Value not set.");

        } else {
            // No need to check validity
            settings[settingName] = newSettings[settingName];
        }
    }
}

exports.setSettings = function(settingsObj) {
    applySetting("appToken", settingsObj, []);
    applySetting("appTokenRequired", settingsObj, [exports.APP_TOKEN_ALWAYS_REQUIRED, exports.APP_TOKEN_NEVER_REQUIRED, exports.APP_TOKEN_PER_REQUEST_REQUIRED]);
    applySetting("authenticatorMethod", settingsObj);
    applySetting("documentationUrl", settingsObj);
    applySetting("applicationName", settingsObj);
    applySetting("apiRoot", settingsObj);
}