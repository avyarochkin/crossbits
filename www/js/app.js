/* global angular */
angular.module('crossbits', [
    'ionic',
    'ui.router',
    'ngCordova',
    'ngIOS9UIWebViewPatch',
    'crossbits.directives',
    'crossbits.controllers',
    'crossbits.services'
])

.config(function($stateProvider, $urlRouterProvider) {

    $stateProvider.state('start', {
        url: '/',
        templateUrl: 'templates/start.html',
        controller: 'StartCtrl'
    });

    $stateProvider.state('create', {
        url: '/create',
        templateUrl: 'templates/board_size.html',
        controller: 'NewGameCtrl'
    });

    $stateProvider.state('load', {
        url: '/load',
        templateUrl: 'templates/board_list.html',
        controller: 'LoadGameCtrl'
    });

    $stateProvider.state('game', {
        url: '/game',
        templateUrl: 'templates/board.html',
        controller: 'BoardCtrl'
    });

    $urlRouterProvider.otherwise('/load');
});
