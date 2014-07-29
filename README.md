haypeaeye
=========

NodeJS Express API Library for creating APIs that self document and validate. The motivation behind haypeaeye was that I hated the idea of writing + commenting an API library in code and then having to write up the API again in a completely different place. This ultimately leads to inconsistencies between your code and your documentation... hayepeaeye fixes this.

Note: this is just the beginnings of the documentation, more will be added soon.

haypeaeye works alongside Express, and provides:
* a way to easily define API endpoints WITH documentation
* additional validation of parameters (e.g. of the parameter types you are passing into your API method)
* an auto-generated documentation site with a console to try things out
* a way to hook in to your existing authentication methods (for api methods that need to be protected)


### Getting Started
In your app.js: `var haypeaeye = require('haypeaeye')`

Then add the following code snippet to set some initial settings:

```
// Haypeaeye Setup
haypeaeye.setSettings({
    authenticatorMethod: function(req, callback) {
        // Set this method to return if you want to provide a way of authenticating some API calls
        // The callback should return function(err, user)

    },
    authAttributes: [
        {name: "appKey", description: "Application key", type: exports.String},
        {name: "appToken", description: "Application token (if applicable)", type: exports.String},
        {name: "userToken", description: "User token (if applicable)", type: exports.String}
    ],
    applicationName: "Your application name"
});

```

Finally, add the following code snippet to your app.js file, so that hayepeaeye can process all routes beginning with /api/

```
app.all("/api/*", function(req, res, next) {
    haypeaeye.handleRequest(req, res, next);
});
```

### Defining API Routes
You define haypeaeye routes in a similar way as you would Express routes. You can place the route definitions either in the app.js file, or across multiple route files.

Here is an example haypeaeye route definition:

```
haypeaeye.addApiMethod(
    "/api/say/hello", haypeaeye.GET,
    "Says hello to the specified user",
    {grouping: "Greetings", auth: haypeaeye.AUTH_NOT_REQUIRED},
    [
        {name: "first_name", type: haypeaeye.String, required: true, description: "User's first name"},
    ],
    function(req, res) {
        hayepeaeye.successReponse(res, {"message": "Hello " + req.query.first_name});
    }
);
```

#### Parameter types
The following parameter types are currently supported:
* haypeaeye.String
* haypeaeye.Number
* haypeaeye.Date
* haypeaeye.File - although see note below about adding a multipart middleware

#### Response utility methods
Haypeaeye provides some utility methods for returning standard responses from your methods. These are:

* Success - for returning a success response, where jsonContent is the response you are returning
        ```
        haypeaeye.successResponse(res, jsonContent);
        ```
* Error - for returning an error response (500), where err is the response you are returning (JSON object)
        ```
        haypeaeye.successResponse(res, err);
        ```

* Success or error - makes it easy for you to return an error or success depending directly on a callback
        ```
        haypeaeye.successOrErrorResponse(res, err, successData);
        ```

* Unathourised - for indicating that the user does not have permission to do that
        ```
        haypeaeye.unauthorisedResponse(res, message);
        ```

### Accessing API Docs
haypeaeye will automatically generate API documentation for you in HTML (and JSON) format. To access the HTML docs go to the following URL on your server:

/api/docs/html


### Note on File Uploads
If you want to be able to upload files to your server, you'll need to include an Express middleware module like 'connect-multiparty' in your main app.js file, an example is below:

```
var multipart = require('connect-multiparty'); // For haypeaeye file uploads
var multipartMiddleware = multipart();
```

You then need to modify your app.all route for haypeaeye as shown below:

```
app.all("/api/*", multipartMiddleware function(req, res, next) {
    haypeaeye.handleRequest(req, res, next);
});
```

You can then access your parameters via req.files.param_name

It is well worth cleaning up the temp files that are generated from uploads after you're done with them. Haypeaeye provides a utility method that does this for you (where req is the ExpressJS request object):

```
haypeaeye.removeTempFiles(req);
```



