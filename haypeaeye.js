var moment = require("moment");
var path = require('path');
var fs = require('fs');
var apiDocsPath = path.join(__dirname, '/apidocs');

var DEFAULT_VIDEO_STREAM_CONTENT_TYPE = "video/mp4";

exports.DATE_FORMAT = "YYYY-MM-DD HH:mm"

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
exports.Enum = "Enum";
exports.Array = "Array";
exports.Date = "Date";

exports.GET = "GET";
exports.POST = "POST";
exports.PUT = "PUT";
exports.DELETE = "DELETE";

exports.DOCS_SUFFIX = ".docs";
exports.DOCS_PATH = "/docs";

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

    // See if we have any files in the params - i.e. does this method need to be multipart
    var methodHasFiles = false;

    if (params && params.length > 0) {
        for (var i = 0; i < params.length; i++) {
            if (params[i].type == exports.File) {
                methodHasFiles = true;
                break;
            }
        }
    }

    if (methodHasFiles && method != exports.POST) {
        console.error("You have specified a method that takes files but is not POST - " + url);
    }

    apiMethods[method + "_" + url] = {
        url: url,
        method: method,
        title: title,
        params: params,
        callback: callback,
        options: options,
        multipart: methodHasFiles
    };

    if (regExpStr != "") {
        apiMethods[method + "_" + url].regexp = regExpStr;
    }
};

exports.getAttributeFromRequest = function(req, attrName) {
    return exports.getAttribute(req, attrName, req.method);
}

exports.getAttribute = function(req, attrName, methodType) {
    if (req.params && req.params[attrName]) {
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
        } else if (req.files && req.files[attrName]) {
            return req.files[attrName];
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
            if ((param.required || param.index != undefined) && (!exports.getAttribute(req, param.name, methodToCall.method))) {
                // Check this isn't a false boolean
                if (!(param.type && param.type == exports.Boolean)) {
                    res.send(400, {error: "Required attribute not present, '" + param.name + "'"});
                    return;
                }
            }

            var rawValue = exports.getAttribute(req, param.name, methodToCall.method);

            if (rawValue != null) {
                // Begin more detailed validations
                if (param.type && param.type == exports.Number) {
                    if (isNaN(rawValue)) {
                        res.send(400, {error: "Attribute '" + param.name + "' is not a valid number"});
                        return;
                    }
                }

                // Dates
                if (param.type && param.type == exports.Date) {
                    var dateValue = moment(rawValue, exports.DATE_FORMAT);
                    if (!dateValue.isValid()) {
                        res.send(400, {error: "Attribute '" + param.name + "' is not a valid date. Format should be YYYY-MM-DD HH:mm"});
                        return;
                    }
                }

                // Enums
                if (param.type && param.type == exports.Enum && param.validValues && param.validValues.length > 0) {
                    // Check that the value the user entered is a valid value
                    var validValue = false;

                    for (var v = 0; v < param.validValues.length; v++) {
                        if (rawValue == param.validValues[v]) {
                            validValue = true;
                            break;
                        }
                    }

                    if (!validValue) {
                        res.send(400, {error: "Attribute '" + param.name + "' is not a valid value"});
                        return;
                    }
                }

                // Arrays
                if (param.type && param.type == exports.Array) {
                    if (!(rawValue instanceof Array)) {
                        res.send(400, {error: "Attribute '" + param.name + "' is not a valid array"});
                        return;
                    }
                }

            }
        }
    }

    methodToCall.callback(req, res);

}

exports.handleRequest = function(req, res, next) {
    var htmlDocsUrl = settings.documentationUrl + "/html";

    if (req.method == exports.GET && req.url.indexOf(htmlDocsUrl) >= 0) {
        // HTML docs
        if (req.url == htmlDocsUrl) {
            res.redirect(settings.documentationUrl + "/html/index.html");
        } else {
            var strWithoutStartOfUrl = req.url.substr(req.url.indexOf(htmlDocsUrl) + htmlDocsUrl.length);
            res.sendfile(apiDocsPath + strWithoutStartOfUrl);
        }
    } else if (req.method == exports.GET && req.url == settings.documentationUrl + "/settings") {
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

// Useful for calling if you are uploading files, after you have done whatever you wanted to do with the file
exports.removeTempFiles = function(req) {
    if (req.files) {
        for (var fileFieldName in req.files) {
            fs.unlink(req.files[fileFieldName].path);
        }
    }
}

exports.setSettings = function(settingsObj) {
    applySetting("appToken", settingsObj, []);
    applySetting("appTokenRequired", settingsObj, [exports.APP_TOKEN_ALWAYS_REQUIRED, exports.APP_TOKEN_NEVER_REQUIRED, exports.APP_TOKEN_PER_REQUEST_REQUIRED]);
    applySetting("authenticatorMethod", settingsObj);
    applySetting("documentationUrl", settingsObj);
    applySetting("applicationName", settingsObj);
    applySetting("authAttributes", settingsObj);
    applySetting("apiRoot", settingsObj);
}

// UTILITY METHODS FOR SENDING RESPONSES IN STANDARD FORMATS
exports.errorResponse = function (res, err) {
    if (err === null) {
        res.send(500, {status: "error", error: "No results"});
    } else {
        if (err.message) {
            res.send(500, {status: "error", error: err.message});
        } else {
            res.send(500, {status: "error", error: err});
        }
    }

};

exports.successResponse = function (res, data) {
    res.json({status: "ok", data: data});
};

exports.successOrErrorResponse = function (res, err, data) {
    if (err) {
        exports.errorResponse(res, err);
    } else {
        exports.successResponse(res, data);
    }
};

exports.unauthorisedResponse = function (res, message) {
    var errMessage = "Not logged in or authorised app"
    if (message) {
        errMessage = message;
    }

    res.send(401, {status: "error", error: errMessage});
};

// Stream Video Utility Method
// Thanks to https://gist.github.com/paolorossi/1993068
exports.streamVideo = function(req, res, path, contentType) {
    var contentTypeToUse = DEFAULT_VIDEO_STREAM_CONTENT_TYPE;

    if (contentType && contentType != "") {
        contentTypeToUse = contentType;
    }

    fs.exists(path, function(exists) {
        if (exists) {
            var stat = fs.statSync(path);
            var total = stat.size;
            if (req.headers['range']) {
                var range = req.headers.range;
                var parts = range.replace(/bytes=/, "").split("-");
                var partialstart = parts[0];
                var partialend = parts[1];

                var start = parseInt(partialstart, 10);
                var end = partialend ? parseInt(partialend, 10) : total - 1;
                var chunksize = (end - start) + 1;

                var file = fs.createReadStream(path, {start: start, end: end});
                res.writeHead(206, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': 'video/mp4' });
                file.pipe(res);
            } else {
                res.writeHead(200, { 'Content-Length': total, 'Content-Type': contentTypeToUse});
                fs.createReadStream(path).pipe(res);
            }
        }
        else {
            exports.errorResponse(res, "Invalid file path for streaming");
        }

    });

}
