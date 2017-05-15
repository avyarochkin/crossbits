/* global angular ionic STATUS CELL SIDE HINTKIND */

angular.module('crossbits.controllers', ['ionic'])

.controller('AppCtrl', function($scope, $ionicPopup, $timeout) {

    ionic.Platform.ready(function() {

        ionic.Platform.fullScreen(true, false);
        ionic.Platform.showStatusBar(false);
        // StatusBar.overlaysWebView(true);
        // StatusBar.styleBlackTranslucent();
        // StatusBar.hide();
    });

    $scope.confirmPopup = function(title, cancelText, okText, action) {
        $ionicPopup.confirm({
            title: title,
            cssClass: 'popup-dark',
            cancelText: cancelText,
            cancelType: 'button-dark',
            okText: okText,
            okType: 'button-assertive'
        }).then(action);
    };

    $scope.infoPopup = function(title, action, delay) {
        var popup = $ionicPopup.show({
            title: '<i class="icon ion-checkmark"></i> ' + title
        });
        $timeout(function() {
            popup.close();
            if (action) action();
        }, delay || 500);
    };

    $scope.inputPopup = function(title, value, action) {
        $scope.input = {
            value: value
        };
        $ionicPopup.show({
            template: '<input type="number" min="0" max="50" maxlength="2" ng-model="input.value">',
            title: title,
            scope: $scope,
            buttons: [{
                text: 'Cancel'
            }, {
                text: 'OK',
                type: 'button-dark',
                onTap: function(e) {
                    //e.preventDefault();
                    return $scope.input.value;
                }
            }]
        }).then(action);
    };
})


.controller('MainCtrl', function($scope, /*$cordovaStatusbar,*/ Game) {
    $scope.allBoards = Game.allBoards();
    //$cordovaStatusbar.hide();
})


.controller('NewGameCtrl', function($scope, $state, Game) {
    $scope.size = {
        x: 5, minX: 2, maxX: 50,
        y: 5, minY: 2, maxY: 50
    };

    $scope.editBoard = function() {
        Game.initWithSize($scope.size.x, $scope.size.y, STATUS.SETUP);
        $state.go('game');
    };
})


.controller('LoadGameCtrl', function($scope, $state, Game) {

    $scope.allBoards = Game.allBoards();

    $scope.loadGame = function(board) {
        Game.initFromSaved(board, STATUS.GAME);
        $state.go('game');
    };

    $scope.editGame = function(board) {
        Game.initFromSaved(board, STATUS.SETUP);
        $state.go('game');
    };

})


.controller('BoardCtrl', function($scope, $state, $ionicHistory, $ionicGesture, $ionicModal, Game, $ionicScrollDelegate) {

    $scope.boardData = Game.boardData();
    $scope.boardSize = Game.boardSize();
    $scope.columnHints = Game.columnHints();
    $scope.rowHints = Game.rowHints();

    var boardElement = angular.element(document.querySelector('#board'));
    var dragObj = null;

    function checkGameStatus() {
        if (Game.boardStatus() === STATUS.OVER) {
            $scope.infoPopup('Congratulation!', null, 1000);
        }
    }

    function boardDivToXY(div) {
        var attrX = div.attributes['x'], attrY = div.attributes['y'];
        if (attrX && attrY) {
            return {
                x: parseInt(attrX.value),
                y: parseInt(attrY.value)
            };
        } else {
            return false;
        }
    }

    function toggleCellValue(value) {
        return (value === CELL.ON)
            ? CELL.OFF
            : (value === CELL.OFF)
                ? CELL.NIL
                : CELL.ON;
    }

    function toggleCell(div) {
        var xy = boardDivToXY(div);
        if (xy) {
            var value = $scope.boardData[xy.y][xy.x].value;
            Game.setBoardXY(xy.x, xy.y, toggleCellValue(value));
            checkGameStatus();
        }
    }

    function dsgn(a, b) {
        return (b === a) ? 0 : (b > a) ? 1 : -1;
    }

    function setCellsAtoB(A, B, value) {
        var dx = dsgn(A.x, B.x);
        var dy = dsgn(A.y, B.y);
        if (dx || dy) {
            Game.undoData().startBlock();
            for (var x = A.x, y = A.y; (dx === 0 || x !== B.x + dx) && (dy === 0 || y !== B.y + dy); x += dx, y += dy) {
                Game.setBoardXY(x, y, value);
            }
            Game.undoData().endBlock();
            checkGameStatus();
        }
    }

    $ionicGesture.on('tap', function(e) {

        function handleSetupMode(kind, x, y) {
            switch (kind) {
                case HINTKIND.TOP:
                    $scope.editColumnHint(x, y, SIDE.TOP);
                    break;
                case HINTKIND.BOTTOM:
                    $scope.editColumnHint(x, y, SIDE.BOTTOM);
                    break;
                case HINTKIND.LEFT:
                    $scope.editRowHint(y, x, SIDE.LEFT);
                    break;
                case HINTKIND.RIGHT:
                    $scope.editRowHint(y, x, SIDE.RIGHT);
                    break;
            }
        }

        function handleGameMode(kind, x, y) {
            switch (kind) {
                case HINTKIND.TOP:
                case HINTKIND.BOTTOM:
                    $scope.solveColumn(x);
                    checkGameStatus();
                    break;
                case HINTKIND.LEFT:
                case HINTKIND.RIGHT:
                    $scope.solveRow(y);
                    checkGameStatus();
                    break;
                case 'data':
                    toggleCell(e.target);
                    break;
            }
        }

        var attrKind = e.target.attributes['kind'];
        var attrX = e.target.attributes['x'];
        var attrY = e.target.attributes['y'];

        if (attrKind && attrX && attrY) {
            $scope.$apply(function() {

                if ($scope.isSetup()) {
                    handleSetupMode(attrKind.value, attrX.value, attrY.value);
                } else if ($scope.isGame()) {
                    handleGameMode(attrKind.value, attrX.value, attrY.value);
                }

            });
        }

    }, boardElement);


    $ionicGesture.on('hold', function(e) {
        $scope.$apply(function() {
            var attrKind = e.target.attributes['kind'];

            // only single touch draws a line
            if ($scope.isGame() && attrKind && attrKind.value === 'data' && e.gesture.touches.length === 1) {
                var xy = boardDivToXY(e.target);
                dragObj = {
                    start: xy,
                    current: xy,
                    value: toggleCellValue($scope.boardData[xy.y][xy.x].value),
                    orientation: null
                };
                $ionicScrollDelegate.$getByHandle('boardScroll').freezeScroll(true);
            } else {
                dragObj = null;
            }
        });
    }, boardElement);


    $ionicGesture.on('release', function(e) {
        dragObj = null;
        $ionicScrollDelegate.$getByHandle('boardScroll').freezeScroll(false);
    }, boardElement);


    $ionicGesture.on('drag', function(e) {
        $scope.$apply(function() {

            var attrKind = e.target.attributes['kind'];
            if ($scope.isGame() && attrKind && attrKind.value === 'data' && dragObj) {
                var touch = e.gesture.touches[0];
                var xy = boardDivToXY(document.elementFromPoint(touch.clientX, touch.clientY));
                var firstDrag = false;

                // determine the dragging orientation
                if (xy && !dragObj.orientation) {
                    if (xy.x !== dragObj.start.x) {
                        dragObj.orientation = 'X';
                        firstDrag = true;
                    } else if (xy.y !== dragObj.start.y) {
                        dragObj.orientation = 'Y';
                        firstDrag = true;
                    }
                }

                // set all cells based on the 1st accoring to the dragging orientation
                if (xy && dragObj.orientation === 'X' && xy.x !== dragObj.current.x) {
                    // horizontal orientation - resetting y-coord
                    xy.y = dragObj.start.y;
                    dragObj.current = xy;
                    if (!firstDrag) {
                        $scope.undo();
                    }
                    if (xy.x !== dragObj.start.x) {
                        setCellsAtoB(xy, dragObj.start, dragObj.value);
                    } else {
                        dragObj.orientation = null;
                    }
                }
                else if (xy && dragObj.orientation === 'Y' && xy.y !== dragObj.current.y) {
                    // vertical orientation - resetting x-coord
                    xy.x = dragObj.start.x;
                    dragObj.current = xy;
                    if (!firstDrag) {
                        $scope.undo();
                    }
                    if (xy.y !== dragObj.start.y) {
                        setCellsAtoB(xy, dragObj.start, dragObj.value);
                    } else {
                        dragObj.orientation = null;
                    }

                }
            }
        });
    }, boardElement);

    $scope.$on('$ionicView.beforeEnter',function() {
        var initZoomX = window.innerWidth / $scope.boardSize.x;
        var initZoomY = window.innerHeight / $scope.boardSize.y;
        var zoom = Math.min(initZoomX, initZoomY, 1.5);
        $ionicScrollDelegate.$getByHandle('boardScroll').zoomBy(zoom, true, 0);
        console.log('Zoom ' + zoom);
    });

    $scope.isSetup = function() {
        return (Game.boardStatus() === STATUS.SETUP);
    };

    $scope.isGame = function() {
        return (Game.boardStatus() === STATUS.GAME);
    };

    $scope.isGameOver = function() {
        return (Game.boardStatus() === STATUS.OVER);
    },

    $scope.isNewBoard = function() {
        return (Game.boardIndex() >= Game.savedBoards().length);
    };


    var dirIndex = 'UDLR';
    var dX = [0, 0, -1, 1];
    var dY = [-1, 1, 0, 0];

    $scope.hintPad = {

        value: 0,
        min: 0,
        max: 50,

        init: function(x, y, side) {
            this.x = parseInt(x);
            this.y = parseInt(y);
            this.side = side;

            this.setFromHints();
            this.ctrl.show();
        },
        at: function(x, y, side) {
            return x === this.x && y === this.y && side === this.side;
        },
        move: function(dir) {
            var index = dirIndex.indexOf(dir);
            if (index >= 0) {
                this.x += dX[index];
                this.y += dY[index];
                this.setFromHints();
            }
        },
        setFromHints: function() {
            var v = this.getHint(this.x, this.y, this.side);
            this.value = (v) ? v : 0;
            console.log('hint-pad[' + this.x + ',' + this.y + '] set to ' + this.value);
        },
        change: function() {
            if (this.setHint) {
                $scope.$apply();
                var xy = this.setHint(this.x, this.y, this.side, this.value);
                this.x = xy.x;
                this.y = xy.y;
            }
        }
    };


    $ionicModal.fromTemplateUrl('templates/hint_pad.html', {
        scope: $scope,
        animation: 'fade-in'
    }).then(function(ctrl) {
        $scope.hintPad.ctrl = ctrl;
    });


    $scope.editColumnHint = function(x, y, side) {

        $scope.hintPad.getHint = function(x, y, side) {
            return $scope.columnHints.getHint(x, y, side);
        };

        $scope.hintPad.setHint = function(x, y, side, value) {
            return $scope.columnHints.setHint(x, y, side, value);
        };

        $scope.hintPad.canMove = function(dir) {
            switch (dir) {
                case 'U': return $scope.hintPad.y > 0;
                case 'D': return $scope.hintPad.y < $scope.columnHints.getMaxY()-1;
                case 'L': return $scope.hintPad.x > 0;
                case 'R': return $scope.hintPad.x < $scope.columnHints.col.length-1;
            }
            return false;
        };

        $scope.hintPad.init(x, y, side);
    };


    $scope.editRowHint = function(y, x, side) {

        $scope.hintPad.getHint = function(x, y, side) {
            return $scope.rowHints.getHint(y, x, side);
        };

        $scope.hintPad.setHint = function(x, y, side, value) {
            return $scope.rowHints.setHint(y, x, side, value);
        };

        $scope.hintPad.canMove = function(dir) {
            switch (dir) {
                case 'U': return $scope.hintPad.y > 0;
                case 'D': return $scope.hintPad.y < $scope.rowHints.row.length-1;
                case 'L': return $scope.hintPad.x > 0;
                case 'R': return $scope.hintPad.x < $scope.rowHints.getMaxX()-1;
            }
            return false;
        };

        $scope.hintPad.init(x, y, side);
    };


    $scope.solveColumn = function(x) {
        $scope.columnHints.solveCol(x);
    };


    $scope.solveRow = function(y) {
        $scope.rowHints.solveRow(y);
    };


    $scope.save = function() {
        Game.saveCurrentBoard();
        $scope.infoPopup('Saved', function() {
            $ionicHistory.goBack(-2);
        });
    };


    $scope.delete = function() {
        $scope.confirmPopup('Delete this board?', 'Keep', 'Delete',
            function(result) {
                if (result) {
                    Game.deleteCurrentBoard();
                    $ionicHistory.goBack(-2);
                }
            });
    };


    $scope.canUndo = function() {
        return Game.undoData().canUndo();
    };


    $scope.canRedo = function() {
        return Game.undoData().canRedo();
    };


    $scope.clear = function() {
        $scope.confirmPopup('Clear this board?', 'No', 'Yes',
            function(result) {
                if (result) {
                    Game.resetBoard($scope.boardData[0].length, $scope.boardData.length);
                }
            });
    };


    $scope.undo = function() {
        Game.undoData().undo();
    };


    $scope.redo = function() {
        Game.undoData().redo();
    };
});
