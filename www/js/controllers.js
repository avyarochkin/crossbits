angular.module('crossbits.controllers', [])

.controller('AppCtrl', function($scope, $ionicPopup, $timeout, $cordovaStatusbar) {

    //$cordovaStatusbar.hide();

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
            }],
        }).then(action);
    };
})


.controller('MainCtrl', function($scope, /*$cordovaStatusbar,*/ Game) {
    $scope.savedBoards = Game.savedBoards();
    //$cordovaStatusbar.hide();
})


.controller('NewGameCtrl', function($scope, $state, Game) {
    $scope.size = {
        x: 5, minX: 2, maxX: 50,
        y: 5, minY: 2, maxY: 50
    };

    $scope.editBoard = function() {
        Game.initWithSize($scope.size.x, $scope.size.y, STATUS_SETUP);
        $state.go("game");
    }
})


.controller('LoadGameCtrl', function($scope, $state, Game, $ionicSlideBoxDelegate) {

    $scope.savedBoards = Game.savedBoards();

    $scope.loadGame = function(board) {
        Game.initFromSaved(board, STATUS_GAME);
        $state.go("game");
    };

    $scope.editCurrentBoard = function() {
        var board = $scope.savedBoards[$ionicSlideBoxDelegate.currentIndex()];
        Game.initFromSaved(board, STATUS_SETUP);
        $state.go("game");
    };
})


.controller('BoardCtrl', function($scope, $ionicHistory, $ionicGesture, $ionicPopup, $ionicModal, Game, $ionicScrollDelegate) {

    $scope.boardData = Game.boardData();
    $scope.boardSize = Game.boardSize();
    $scope.columnHints = Game.columnHints();
    $scope.rowHints = Game.rowHints();

    var dragObj = null;

    function boardXY(div) {
        var attrX = div.attributes["x"], attrY = div.attributes["y"];
        if (attrX && attrY) {
            return {
                x: parseInt(attrX.value),
                y: parseInt(attrY.value)
            }
        } else {
            return false;
        }
    }

    function nextCellValue(value) {
        return (value === CELL_ON) ? CELL_OFF : (value === CELL_OFF) ? CELL_NIL : CELL_ON;
    }

    function toggleCell(div) {
        var xy = boardXY(div);
        if (xy) {
            var value = $scope.boardData[xy.y][xy.x].value;
            Game.setBoardData(xy.y, xy.x, nextCellValue(value));
            $scope.columnHints.checkCol(xy.x);
            $scope.rowHints.checkRow(xy.y);
        }
    }

    function setCellsAtoB(A, B, value) {
        var dx = (B.x === A.x) ? 0 : (B.x > A.x) ? 1 : -1;
        var dy = (B.y === A.y) ? 0 : (B.y > A.y) ? 1 : -1;
        if (dx || dy) {
            Game.undoData().startBlock();
            for (var x = A.x, y = A.y; (dx === 0 || x !== B.x + dx) && (dy === 0 || y !== B.y + dy); x += dx, y += dy) {
                Game.setBoardData(y, x, value);
                $scope.columnHints.checkCol(x);
                $scope.rowHints.checkRow(y);
            }
            Game.undoData().endBlock();
        }
    }

    var boardElement = angular.element(document.querySelector("#board"));


    $ionicGesture.on('tap', function(e) {

        function handleSetupMode(kind, x, y) {
            switch (kind) {
                case 'tophint':
                    $scope.editColumnHint(x, y, 'T');
                    break;
                case 'bottomhint':
                    $scope.editColumnHint(x, y, 'B');
                    break;
                case 'lefthint':
                    $scope.editRowHint(y, x, 'L');
                    break;
                case 'righthint':
                    $scope.editRowHint(y, x, 'R');
                    break;
            }
        };

        function handleGameMode(kind, x, y) {
            switch (kind) {
                case 'tophint':
                case 'bottomhint':
                    $scope.solveColumn(x);
                    break;
                case 'lefthint':
                case 'righthint':
                    $scope.solveRow(y);
                    break;
                case 'data':
                    toggleCell(e.target);
                    break;
            }
        };

        var attrKind = e.target.attributes["kind"];
        var attrX = e.target.attributes["x"];
        var attrY = e.target.attributes["y"];

        if (attrKind && attrX && attrY) {
            $scope.$apply(function() {

                if ($scope.isSetup()) {
                    handleSetupMode(attrKind.value, attrX.value, attrY.value);
                } else /* !$scope.isSetup() */ {
                    handleGameMode(attrKind.value, attrX.value, attrY.value);
                }

            });
        }

    }, boardElement);


    $ionicGesture.on('hold', function(e) {
        $scope.$apply(function() {
            var attrKind = e.target.attributes["kind"];
            // only single touch draws a line
            if (!$scope.isSetup() && attrKind && attrKind.value === 'data' && e.gesture.touches.length === 1) {
                var xy = boardXY(e.target);
                dragObj = {
                    start: xy,
                    current: xy,
                    value: nextCellValue($scope.boardData[xy.y][xy.x].value),
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
            var attrKind = e.target.attributes["kind"];
            if (!$scope.isSetup() && attrKind && attrKind.value === 'data' && dragObj) {
                var touch = e.gesture.touches[0];
                var xy = boardXY(document.elementFromPoint(touch.clientX, touch.clientY));
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
        $ionicScrollDelegate.$getByHandle('boardScroll').zoomBy(zoom, false, 0);
        console.log('Zoom ' + zoom);
    });

    $scope.isSetup = function() {
        return (Game.boardStatus() === STATUS_SETUP);
    };

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
