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
        res.json({"message": "Hello " + req.query.first_name});
    }
);
```

### Accessing API Docs
haypeaeye will automatically generate API documentation for you in HTML (and JSON) format. To access the HTML docs go to the following URL on your server:

/api/docs/html






