angular.module('crossbits.directives', [])

.directive('numPicker', function($ionicScrollDelegate, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/num_picker.html',
        scope: {
            'value': '=',
            'min': '=',
            'max': '=',
            'change': '&'
        },

        controller: function($scope, $element) {
            $scope.numbers = [' '];
            var l = $scope.max.toString().length;
            for (var i = $scope.min; i <= $scope.max; i++) {
                var s = '000000' + i;
                $scope.numbers.push(s.substr(s.length-l, l));
            }
            $scope.numbers.push('');
            console.log('num-picker: INIT (min: ' + $scope.min + ', max: ' + $scope.max + ')');
        },

        link: function($scope, element, attributes) {

            var scrollElement = element.find('ion-scroll');

            var delegate = function() {
                var result;
                $ionicScrollDelegate._instances.forEach(function(instance) {
                    if (instance.element === scrollElement[0]) {
                        result = instance;
                    }
                });
                return result;
            };

            var _numHeight;
            var numHeight = function() {
                if (!_numHeight) {
                    var numElement = scrollElement.children().children();
                    if (numElement.length) {
                        _numHeight = numElement[0].offsetHeight;
                    }
                }
                return _numHeight;
            };

            // initial scollling to match the value
            $timeout(function() {
                // var scrollView = delegate().getScrollView();
                // scrollView.options.snapping = true;
                // scrollView.setSnapSize(0, numHeight());

                delegate().scrollTo(0, numHeight() * ($scope.value - $scope.min), false);
                console.log('num-picker: RENDER (value: ' + $scope.value + ')');
            });

            var scrolling = false;

            $scope.$watch('value', function(newValue) {
                if (!scrolling) {
                    delegate().scrollTo(0, numHeight() * (newValue - $scope.min), false);
                }
            });

            scrollElement.on('scroll', function(e) {

                var v = Math.trunc(e.detail.scrollTop / numHeight() + 0.5) + $scope.min;

                if ($scope.value !== v) {
                    scrolling = true;
                    $scope.value = v;
                    console.log('num-picker: SET ' + v);
                    $scope.change();
                    $scope.$apply();
                    scrolling = false;
                }
            });

            // scrollElement.on('release', function(e) {
            //     delegate().scrollTo(0, numHeight() * ($scope.value - $scope.min), true);
            // });

            $scope.$on('$destroy', function() {
                scrollElement.off('scroll release');
                console.log('num-picker: DESTROY');
            });
        }
    };
});
