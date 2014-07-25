apiApp.controller('ApiController', ['$scope', '$http', '$location',
    function ApiController($scope, $http, $location) {
        $scope.settings = null;
        $scope.loaded = false;
        $scope.groups = {
            ungrouped: []
        };
        $scope.page = "overview";
        $scope.groupNames = [];

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

                            $scope.groups[method.options.grouping].push(method);

                        } else {
                            // Ungrouped method
                            $scope.groups.ungrouped.push(method);
                        }

                    }

                    // Add the group names to an array
                    for (var key in $scope.groups) {
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

        $scope.showConsoleModal = function(method) {
            $scope.consoleMethod = method;
            $scope.results = null;
            $scope.resultsError = null;
            $scope.resultsErrorCode = null;
            $scope.consoleParams = {};
            $('#consoleModal').modal();
        }

        $scope.getParamValue = function(param) {
            if (param.type == "Object") {
                return JSON.parse($("#param_" + param.name).val());
            } else {
                return $("#param_" + param.name).val();
            }
        }

        $scope.runConsoleMethod = function() {
            $scope.results = null;
            $scope.resultsError = null;
            $scope.resultsErrorCode = null;


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
                for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
                   if (extraUrlStr.length > 0) {
                        extraUrlStr = extraUrlStr + "&";
                   } else {
                        extraUrlStr = extraUrlStr + "?";
                   }

                   extraUrlStr = extraUrlStr + $scope.settings.authAttributes[i].name + "=" + $("#auth_" + $scope.settings.authAttributes[i].name).val();
                }

            } else {
                // POST or PUT
                for (var i = 0; i < $scope.consoleMethod.params.length; i++) {
                    if ($scope.consoleMethod.params[i].index == undefined) {
                        postObject[$scope.consoleMethod.params[i].name] = $scope.getParamValue($scope.consoleMethod.params[i]);
                    }
                }

                // Now add in any auth params
                for (var i = 0; i < $scope.settings.authAttributes.length; i++) {
                    postObject[$scope.settings.authAttributes[i].name] = $("#auth_" + $scope.settings.authAttributes[i].name).val();
                }

            }

            $http({method: $scope.consoleMethod.method, url: modifiedUrl + extraUrlStr, data: postObject}).
                success(function(responseData, status, headers, config) {
                    $scope.results = JSON.stringify(responseData, undefined, 4);

                }).
                error(function(data, status, headers, config) {
                    $scope.resultsError = data;
                    $scope.resultsErrorCode = status;
                });
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


    }
]);