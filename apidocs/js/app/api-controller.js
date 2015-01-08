apiApp.controller('ApiController', ['$scope', '$http', '$location', '$sce',
function ApiController($scope, $http, $location, $sce) {
  $scope.settings = null;
  $scope.loaded = false;
  $scope.groups = {
    ungrouped: []
  };
  $scope.page = "overview";
  $scope.groupNames = [];

  const ERROR_CODES = {
    400: "Invalid Request",
    401: "Unauthorised"
  }

  $scope.loadApiSettings = function() {
    $http.get('/api/docs/settings', {}).
    success(function(responseData, status, headers, config) {
      $scope.settings = responseData;
      $scope.loadAllMethods();
    }).
    error(function(data, status, headers, config) {
      alert("Could not load API Documentation");
    });
  }

  $scope.expandMethod = function(method) {
    method.collapsed = false;
  }

  $scope.collapseMethod = function(method) {
    method.collapsed = true;
  }

  $scope.toggleMethodCollapsed = function(method) {
    method.collapsed = !method.collapsed;
  }

  $scope.loadAllMethods = function() {
    $scope.groups = {
      ungrouped: []
    };

    $http.get('/api/docs', {}).
    success(function(responseData, status, headers, config) {
      $scope.allMethods = responseData;

      // Start processing all of the methods into groups
      for (var i = 0; i < $scope.allMethods.length; i++) {
        var method = $scope.allMethods[i];

        if (method.options && method.options.grouping) {
          if (!$scope.groups[method.options.grouping]) {
            $scope.groups[method.options.grouping] = [];
          }

          method.collapsed = true;

          $scope.groups[method.options.grouping].push(method);

        } else {
          // Ungrouped method
          $scope.groups.ungrouped.push(method);
        }

      }

      // Add the group names to an array
      for (var key in $scope.groups) {
        $scope.groups[key].sort(function(a, b) {
          if (a.url <= b.url) {
            return -1;
          } else if (a.url == b.url) {
            return 0;
          } else {
            return 1;
          }
        });

        $scope.groupNames.push(key);
      }

      $scope.groupNames.sort();
      $scope.loaded = true;
      $scope.selectPage();

    }).
    error(function(data, status, headers, config) {
      alert("Could not load API Settings");
    });
  }

  $scope.loadApiSettings();

  $scope.getSavedAuthAttribute = function(authAttributeName) {
    if (window.localStorage[authAttributeName]) {
      return window.localStorage[authAttributeName];
    }
  }

  $scope.showConsoleModal = function(method) {
    $scope.consoleMethod = method;
    $scope.results = null;
    $scope.resultsError = null;
    $scope.resultsErrorCode = null;
    $scope.consoleParams = {};
    $('#consoleModal').modal();
  }

  $scope.showExampleModal = function(method) {
    $scope.consoleMethod = method;
    $scope.selectExample(method.examples[0]);
    $('#exampleModal').modal();
  }

  function syntaxHighlight(json) {
    if (!json || json == "") {
      return null;
    }

    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      var cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  $scope.formatExampleResponse = function() {
    if ($scope.selectedExample) {
      return $sce.trustAsHtml(syntaxHighlight(JSON.stringify($scope.selectedExample.result, undefined, 4)));
    }

  }

  $scope.selectExample = function(example) {
    $scope.selectedExample = example;
  }

  $scope.getParamValue = function(param) {
    if (param.type == "File") {
      var fileInput = document.getElementById("param_" + param.name);
      var file = fileInput.files[0];
      return file;
    } else if (param.type == "Object") {
      return JSON.parse($("#param_" + param.name).val());
    } else {
      return $("#param_" + param.name).val();
    }
  }

  $scope.runConsoleMethod = function() {
    $scope.results = null;
    $scope.resultsError = null;
    $scope.resultsErrorCode = null;

    // If there are any auth params, lets save them to local storage so that they can be easily retrieved
    if ($scope.settings.authAttributes.length > 0) {
      for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
        if ($("#auth_" + $scope.settings.authAttributes[i].name).val()) {
          window.localStorage[$scope.settings.authAttributes[i].name] = $("#auth_" + $scope.settings.authAttributes[i].name).val();
        }
      }
    }

    // Figure out the URL and any URL params
    var modifiedUrl = $scope.consoleMethod.url;

    if ($scope.consoleMethod.params && $scope.consoleMethod.params.length > 0) {
      var urlParams = [];

      for (var i = 0; i < $scope.consoleMethod.params.length; i++) {
        if ($scope.consoleMethod.params[i].index != undefined) {
          urlParams.push($scope.consoleMethod.params[i].name);
        }
      }

      if (urlParams.length > 0) {
        // Sort the array descending so we get and replace, e.g. test2 before test
        urlParams.sort().reverse();

        for (var i = 0; i < urlParams.length; i++) {
          modifiedUrl = modifiedUrl.replace(":" + urlParams[i], $("#param_" + urlParams[i]).val());
        }
      }


    }

    // Figure out GET parameters
    var extraUrlStr = "";
    var postObject = {};

    if (!$scope.consoleMethod.multipart) {
      if ($scope.consoleMethod.method == "GET" && $scope.consoleMethod.params) {
        for (var i = 0; i < $scope.consoleMethod.params.length; i++) {
          if ($scope.consoleMethod.params[i].index == undefined) {
            if (extraUrlStr.length > 0) {
              extraUrlStr = extraUrlStr + "&";
            } else {
              extraUrlStr = extraUrlStr + "?";
            }
            extraUrlStr = extraUrlStr + $scope.consoleMethod.params[i].name + "=" + $("#param_" + $scope.consoleMethod.params[i].name).val();
          }
        }

        // Now add in any auth params we have
        if (!$scope.settings.authInHeaders) {
          for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
            if (extraUrlStr.length > 0) {
              extraUrlStr = extraUrlStr + "&";
            } else {
              extraUrlStr = extraUrlStr + "?";
            }

            extraUrlStr = extraUrlStr + $scope.settings.authAttributes[i].name + "=" + $("#auth_" + $scope.settings.authAttributes[i].name).val();
          }
        }


      } else {
        // POST or PUT
        for (var i = 0; i < $scope.consoleMethod.params.length; i++) {
          if ($scope.consoleMethod.params[i].index == undefined) {
            postObject[$scope.consoleMethod.params[i].name] = $scope.getParamValue($scope.consoleMethod.params[i]);
          }
        }

        // Now add in any auth params
        if (!$scope.settings.authInHeaders) {
          for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
            postObject[$scope.settings.authAttributes[i].name] = $("#auth_" + $scope.settings.authAttributes[i].name).val();
          }
        }
      }

      // Send request
      var headersObj = {};

      if ($scope.settings.authInHeaders) {
        for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
          headersObj[$scope.settings.authAttributes[i].name] = $("#auth_" + $scope.settings.authAttributes[i].name).val();
        }
      }

      // Send request
      $http({method: $scope.consoleMethod.method, url: modifiedUrl + extraUrlStr, headers: headersObj, data: postObject}).
      success(function(responseData, status, headers, config) {
        $scope.results = $sce.trustAsHtml(syntaxHighlight(JSON.stringify(responseData, undefined, 4)));

      }).
      error(function(data, status, headers, config) {
        $scope.resultsError = $scope.results = $sce.trustAsHtml(syntaxHighlight(JSON.stringify(data, undefined, 4)));
        $scope.resultsErrorCode = status;
      });


    } else {
      // This is a multipart method, i.e. it has files too
      var formData = new FormData();

      for (var i = 0; i < $scope.consoleMethod.params.length; i++) {
        if ($scope.consoleMethod.params[i].index == undefined) {
          formData.append($scope.consoleMethod.params[i].name, $scope.getParamValue($scope.consoleMethod.params[i]));
        }
      }

      var headersObj = {
        'Content-Type': undefined
      }

      // Now add in any auth params
      if (!$scope.settings.authInHeaders) {
        for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
          formData.append($scope.settings.authAttributes[i].name, $("#auth_" + $scope.settings.authAttributes[i].name).val());
        }
      } else {
        for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
          headersObj[$scope.settings.authAttributes[i].name] = $("#auth_" + $scope.settings.authAttributes[i].name).val();
        }
      }

      // Send post request
      $http.post(modifiedUrl, formData, {
        transformRequest: angular.identity,
        headers: headersObj
      }).
      success(function(responseData, status, headers, config) {
        $scope.results = $sce.trustAsHtml(syntaxHighlight(JSON.stringify(responseData, undefined, 4)));

      }).
      error(function(data, status, headers, config) {
        $scope.resultsError = $sce.trustAsHtml(syntaxHighlight(JSON.stringify(data, undefined, 4)));
        $scope.resultsErrorCode = status;
      });
    }




  }

  $scope.selectPage = function() {
    $scope.selectedPage = $scope.groups[$scope.page];
  }

  // Page tab changer
  $scope.$watch(function() {
    return $location.path();
  }, function() {
    $scope.page = getTabPage($location.path(), "overview");
    $scope.selectPage();
  });

  $scope.getErrorMapping = function(errorCode) {
    if (ERROR_CODES[errorCode]) {
      return ERROR_CODES[errorCode];
    } else {
      return null;
    }
  }


}
]);
