var apiApp = angular.module('apiApp', []);

function getTabPage(path, defaultTab) {
    if (path && path.length > 1) {
        return path.substr(1);
    } else {
        return defaultTab;
    }
}