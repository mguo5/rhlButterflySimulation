/****************************************************
 * Author: Matt Guo
 * Name: breadboard-visir.js
 * Affiliation: Remote Hub Lab
 * Functionality: The javascript backend for the Flask breadboard GUI,
 * handling the client functionality. Breadboard components contain:
 * switches, not gate, and gate, and or gates. Breadboard.Update() contains
 * the update method, checked upon every user button click to change the states
 * of the components in the breadboard
 ***************************************************/
function extend(Child, Parent){
    Child.prototype = inherit(Parent.prototype);
    Child.prototype.constructor = Child;
    Child.parent = Parent.prototype;
}

function inherit(proto){
    function F(){}
    F.prototype = proto
    return new F
}

// Define RHLab JSON package
if(typeof(RHLab) === "undefined") {
    RHLab = {};
}

if(typeof(RHLab.Widgets) === "undefined") {
    RHLab.Widgets = {};
}
// Initialize the Breadboard container in the RHLab JSON package
RHLab.Widgets.Breadboard = function() {

    var VISIR_SQUARE_SIZE = 13;
    var ORIGINAL_WIRES_LENGTH = 5;
    // var DEFAULT_NUMBER_OF_SWITCHES = 0;

    // Define the outputs from the 40-pin GPIO for the DE1-SoC
    // var OUTPUTS_BY_PIN = {
    //     31: 'V_LED0', // GPIO26
    //     32: 'V_LED1', // GPIO27
    // };

    var OUTPUTS_BY_PIN = {
        31: 'GPIO26', // GPIO26
        32: 'GPIO27', // GPIO27
        37: 'GPIO32',
        39: 'GPIO34',
        36: 'GPIO31',
        38: 'GPIO33',
        40: 'GPIO35',
    };
    var OUTPUTS_BY_PIN_ARRAY = [31, 32, 37, 39, 36, 38, 40];

    // // Define the inputs from the 40-pin GPIO for the DE1-SoC
    // var INPUTS_BY_PIN = {
    //     06: 'V_SW1',  // GPIO6 //PC1
    //     07: 'V_SW2',  // GPIO7
    //     08: 'V_SW3',  // GPIO8
    //     09: 'V_SW4',  // GPIO9
    //     10: 'PA1', //PA1
    //     13: 'V_SW5',  // GPIO10
    //     14: 'V_SW6',  // GPIO11
    //     15: 'V_SW7',  // GPIO12
    //     16: 'V_SW8',  // GPIO13
    //     17: 'V_SW9',  // GPIO14
    //     18: 'V_SW10', // GPIO15
    //     19: 'V_SW11', // GPIO16
    //     20: 'V_SW12', // GPIO17
    //     21: 'PB1', // GPIO18  //PB1
    //     22: 'V_SW14', // GPIO19
    //     23: 'V_SW15', // GND
    //     24: 'V_SW16', // GPIO21
    //     25: 'V_SW17', // GPIO22
    // };

    // Define the inputs from the 40-pin GPIO for the DE1-SoC
    var INPUTS_BY_PIN = {
        33: 'GPIO28',  // GPIO6 //PC1
        34: 'GPIO29',  // GPIO7
        35: 'GPIO30',  // GPIO30
        26: 'GPIO23',  // GPIO8
        27: 'GPIO24',  // GPIO9
    };
    var INPUTS_BY_PIN_ARRAY = [33, 34, 35, 26, 27];

    // Function called by template.html for flask that initalizes a <div> for the breadboard
    function Breadboard($element, endpointBase, numberOfSwitches, imageBase, enableNetwork) {
        var self = this;
        this._components = {};
        this._outputState = {
            // pinNumber: true/false
        };
        this._inputState = {
            // pinNumber: true/false
        };
        this._outputs = []; // Switches
        this._experiment = [];
        this._leds = []; // LEDs
        this._notGate = []; // not gate
        this._andGate = []; //and gate
        this._orGate = []; //or gate
        this._xorGate = []  //xor gate ***newly added***
        this._errors = [];  //potential errors
        this._changedSwitches = [];
        // this._numberOfSwitches = numberOfSwitches || DEFAULT_NUMBER_OF_SWITCHES;
        this._numberOfSwitches = 0;
        this._imageBase = imageBase || (window.STATIC_ROOT + "resources/img/");
        this._enableNetwork = (enableNetwork === undefined)?true:enableNetwork;
        this.allowErrorMessage = true;  //boolean to track if error messaging output should be enabled

        // Start off will all of the breadboard outputs as a False
        $.each(OUTPUTS_BY_PIN, function (pinNumber, name) {
            self._outputState[pinNumber] = false;
        });
        // Start off with all of the breadboard inputs as a False
        $.each(INPUTS_BY_PIN, function (pinNumber, name) {
            self._inputState[pinNumber] = false;
        });

        this._$elem = $element;
        this._endpointBase = endpointBase;

        visir.Config.Set("dcPower25", false);
        visir.Config.Set("dcPowerM25", false);

        this._breadboard = new visir.Breadboard(1, $element);

        // Don't need the visir functionality for: Instruments, Power Supplies
        this._HideInstruments();
        this._AddPowerSupplies();
        this._AddComponents();
        // Create a Delete button to delete wires

        $element.find(".reset").off("click");
        $element.find(".reset").click( function(e) {
            var me = self._breadboard;
			if (!visir.Config.Get("readOnly"))
			{
				for(var i=0;i<me._components.length;i++) {
					me._components[i].remove();
				}

				me.SelectWire(null);
				me.SelectComponent(null);
				// me._wires = [];
				// me._DrawWires();
                self._breadboard.Clear();

                self._breadboard.LoadMyCircuit(getOriginalWires(self._numberOfSwitches));
                self._originalNumberOfWires = ORIGINAL_WIRES_LENGTH;

                self.ClearComponentArrays();

                var myString = "yLFd0,d1,d2,d3,d4;\n";
                parent.postMessage({
                    messageType: "web2sim",
                    version: "1.0",
                    value: myString
                }, '*');
			}
		});

        $element.find(".delete").off("click");
        // override the delete button click to remove component rather than place in bin
        $element.find('.delete').click(function () {
            if (!visir.Config.Get("readOnly"))
            {
                var myString = "";
                if (self._breadboard._selectedWire !== null) {
                    self._breadboard._RemoveWire(self._breadboard._wires[self._breadboard._selectedWire]);
                    self._breadboard.SelectWire(null);
                }
                if (self._breadboard._selectedCompnent) {
                    // self._breadboard._selectedCompnent._PlaceInBin();
                    $.each(self._notGate, function(position, gate){
                        if(gate._objVisir._$circle){
                            self._notGate.splice(position, 1);
                            return false;
                        }
                    });
                    $.each(self._andGate, function(position, gate){
                        if(gate._objVisir._$circle){
                            self._andGate.splice(position, 1);
                            return false;
                        }
                    });
                    $.each(self._orGate, function(position, gate){
                        if(gate._objVisir._$circle){
                            self._orGate.splice(position, 1);
                            return false;
                        }
                    });
                    //***newly added */
                    $.each(self._xorGate, function(position, gate){
                        if(gate._objVisir._$circle){
                            self._xorGate.splice(position, 1);
                            return false;
                        }
                    });
                    $.each(self._leds, function(position, led){
                        if(led._objVisir._$circle){
                            myString = "yLFd" + position.toString() + "\n";
                            self._leds.splice(position, 1);
                            return false;
                        }
                    });
                    $.each(self._outputs, function(position, eachSwitch){
                        if(eachSwitch._objVisir._$circle){
                            self._outputs.splice(position, 1);
                            return false;
                        }
                    });
                    self._breadboard._selectedCompnent.remove();
                    self._breadboard.SelectComponent(null);
                }
            }
            parent.postMessage({
                messageType: "web2sim",
                version: "1.0",
                value: myString
            }, '*');
            // example of changing img
            // self._experiment[0]._$elem.find("img").attr("src", "/static/visir/instruments/breadboard/images/butterfly-led-on.png");
            self.Update();
        });
        // this._$elem.find('.delete').click(function () {
        //     self.Update();
        // });
        $(document).on("mouseup.rem touchend.rem mouseup", function(e) {
            self.Update();
        });

        $element.find(".teacher").off("click");

        $element.find(".teacher").click(function(e) {
            var me = self._breadboard;
            $element.find(".componentbox").show();
            $element.find(".componentlist-table").empty();
            var $components = me._$library.find("component").each(function() {
                var img   = $(this).find("rotation").attr("image");
                var type  = $(this).attr("type");
                var value = $(this).attr("value");
                var img_html = '<tr class="component-list-row">\
                <td>\
                <img src="' + me._BuildImageUrl(img) + '"/>\
                </td>\
                <td>' + type + '</td>\
                <td>' + value + '</td>\
                </tr>';
                $element.find(".componentlist-table").append(img_html);

                $($element.find('.component-list-row').get(-1)).click(function(e){
                    var comp_obj = me.CreateComponent(type, value);
                    var xPos = comp_obj.GetPos().x;
                    var yPos = comp_obj.GetPos().y;
                    if(comp_obj._type == "Gate"){
                        if(comp_obj._value == "NOT"){
                            var not0 = new RHLab.Widgets.Breadboard.NotGate("NG1", imageBase, xPos, yPos, comp_obj); //274, 261
                            self._notGate.push(not0);
                            self.AddComponent(not0);
                        }
                        else if(comp_obj._value == "AND"){
                            var and0 = new RHLab.Widgets.Breadboard.AndGate("AG1", imageBase, xPos, yPos, comp_obj);
                            breadboard._andGate.push(and0);
                            breadboard.AddComponent(and0);
                        }
                        else if(comp_obj._value == "OR"){
                            var or0 = new RHLab.Widgets.Breadboard.OrGate("OG1", imageBase, xPos, yPos, comp_obj); // 456, 261
                            breadboard._orGate.push(or0);
                            breadboard.AddComponent(or0);
                        }
                        /***newly added */
                        else if(comp_obj._value == "XOR"){
                            var xor0 = new RHLab.Widgets.Breadboard.XorGate("XG1", imageBase, xPos, yPos, comp_obj); // 456, 261
                            breadboard._xorGate.push(xor0);
                            breadboard.AddComponent(xor0);
                        }
                    }
                    else if(comp_obj._type == "LED"){
                        if(breadboard._leds.length < 5){
                            var led0 = new RHLab.Widgets.Breadboard.LEDs("LED1", imageBase, xPos, yPos, comp_obj);
                            breadboard._leds.push(led0);
                            breadboard.AddComponent(led0);
                        }
                        else{
                            comp_obj.remove();
                            return;
                        }
                        
                        // breadboard._experiment.push(comp_obj);
                    }
                    else if(comp_obj._type == "Switch"){
                        var switch0 = new RHLab.Widgets.Breadboard.Switch("Switch1", imageBase, xPos, yPos, comp_obj);
                        breadboard._outputs.push(switch0);
                        breadboard.AddComponent(switch0);
                    }
                    // setInterval(function () {
                    //     console.log(comp_obj.GetPos());
                    // }, 1000);
                    comp_obj._PlaceInBin();
                });
            });
        });

        visir.Breadboard.prototype.LoadMyCircuit = function(circuit)
        {
            this.Clear();
            var me = this;
            if (!this._$library) {
                this._onLibraryLoaded = function() { me.LoadMyCircuit(circuit); }
                return; // we have to wait until the library is loaded
            }

            var offx = -44;
            var offy = 3;
            
            var $xml = $(circuit);
            $xml.find("component").each(function() {
                var t = $(this).text();
                var args = t.split(" ");
                switch(args[0]) {
                    case "W":
                        var c = parseInt(args[1], 10);
                        var x1 = parseInt(args[2], 10);
                        var y1 = parseInt(args[3], 10);
                        var x2 = parseInt(args[4], 10);
                        var y2 = parseInt(args[5], 10);
                        var x3 = parseInt(args[6], 10);
                        var y3 = parseInt(args[7], 10);

                        var hex = Number(c).toString(16);
                        hex = "#" + "000000".substr(0, 6 - hex.length) + hex;

                        //trace("wire: " + hex)

                        var nWire = new visir.Wire(hex); // XXX
                        me._wires.push(nWire);
                        nWire._start.x = x1 + offx;
                        nWire._start.y = y1 + offy;
                        nWire._mid.x = x2 + offx;
                        nWire._mid.y = y2 + offy;
                        nWire._end.x = x3 + offx;
                        nWire._end.y = y3 + offy;

                        me._DrawWires();

                    break;
                    default:
                        var x = parseInt(args[2], 10);
                        var y = parseInt(args[3], 10);
                        var rot = parseInt(args[4], 10);
                        var comp = me.CreateComponent(args[0], args[1]);
                        comp.Move(x + offx, y + offy);
                        comp.Rotate(rot);
                        var xPos = comp.GetPos().x;
                        var yPos = comp.GetPos().y;
                        if(comp._type == "Gate"){
                            if(comp._value == "NOT"){
                                var not0 = new RHLab.Widgets.Breadboard.NotGate("NG1", imageBase, xPos, yPos, comp); //274, 261
                                self._notGate.push(not0);
                                self.AddComponent(not0);
                            }
                            else if(comp._value == "AND"){
                                var and0 = new RHLab.Widgets.Breadboard.AndGate("AG1", imageBase, xPos, yPos, comp);
                                breadboard._andGate.push(and0);
                                breadboard.AddComponent(and0);
                            }
                            else if(comp._value == "OR"){
                                var or0 = new RHLab.Widgets.Breadboard.OrGate("OG1", imageBase, xPos, yPos, comp); // 456, 261
                                breadboard._orGate.push(or0);
                                breadboard.AddComponent(or0);
                            }
                            /***newly added */
                            else if(comp._value == "XOR"){
                                var xor0 = new RHLab.Widgets.Breadboard.XorGate("XG1", imageBase, xPos, yPos, comp); // 456, 261
                                breadboard._xorGate.push(xor0);
                                breadboard.AddComponent(xor0);
                            }
                        }
                        else if(comp._type == "LED"){
                            var led0 = new RHLab.Widgets.Breadboard.LEDs("LED1", imageBase, xPos, yPos, comp);
                            breadboard._leds.push(led0);
                            breadboard.AddComponent(led0);
                            // breadboard._experiment.push(comp_obj);
                        }
                        else if(comp._type == "Switch"){
                            var switch0 = new RHLab.Widgets.Breadboard.Switch("Switch1", imageBase, xPos, yPos, comp);
                            breadboard._outputs.push(switch0);
                            breadboard.AddComponent(switch0);
                        }

                    break;
                }
                //trace("xxx: " + $(this).text());
            });
        }

        this._breadboard.LoadMyCircuit(getOriginalWires(this._numberOfSwitches));

        if (visir.FIXES === undefined) {
            visir.FIXES = {};
        }

        if (visir.FIXES.oldSelectWire === undefined) {
            visir.FIXES.oldSelectWire = visir.Breadboard.prototype.SelectWire;
        }

        if (visir.FIXES.oldClear === undefined) {
            visir.FIXES.oldClear = visir.Breadboard.prototype.Clear;
        }

        // Not clean at all: trying to override the function
        visir.Breadboard.prototype.SelectWire = function (idx) {
            if (idx !== null && idx < self._originalNumberOfWires) {
                console.log("Original cable. Do not select");
                return;
            }

            visir.FIXES.oldSelectWire.bind(this)(idx);
            self.Update();
        };

        this._insideClear = false;

        visir.Breadboard.prototype.Clear = function() {
            // Whenever "clear", clear but always add the original wires
            if (!self._insideClear) {
                visir.FIXES.oldClear.bind(this)();
                self._insideClear = true;
                // self._breadboard.LoadMyCircuit(getOriginalWires(self._numberOfSwitches));
                // self._originalNumberOfWires = self._breadboard._wires.length;
                self._originalNumberOfWires = ORIGINAL_WIRES_LENGTH;
                self._insideClear = false;
            }
        }

        visir.Breadboard.prototype.SaveCircuitWithOriginalWires = function(circuit)
        {
            // Whenever SaveCircuit, only save wires which were not already there
            var offp = new visir.Point(44, -3);

            var $xml = $("<circuit><circuitlist/></circuit>");

            var $cirlist = $xml.find("circuitlist");
            $cirlist = $xml.find("circuitlist");

            // Sweeps through the number of original, hardcoded wires in the breadboard
            for(var i=0;i<this._wires.length; i++) {
            // for(var i=self._originalNumberOfWires;i<this._wires.length; i++) {
                    var w = this._wires[i];
                    var $wire = $("<component/>");
                    var c = this._ColorToNum(w._color);
                    trace("wire color: " + c);
                    var s = w._start.Add(offp);
                    var m = w._mid.Add(offp);
                    var e = w._end.Add(offp);
                    $wire.text("W " + c + " " + s.x + " " + s.y + " " + m.x + " " + m.y + " " + e.x + " " + e.y);
                    $cirlist.append($wire);
            }

            for(var i=0;i<self._notGate.length; i++) {
                var c = self._notGate[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            for(var i=0;i<self._andGate.length; i++) {
                var c = self._andGate[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            for(var i=0;i<self._orGate.length; i++) {
                var c = self._orGate[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            for(var i=0;i<self._xorGate.length; i++) {
                var c = self._xorGate[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            for(var i=0;i<self._leds.length; i++) {
                var c = self._leds[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            for(var i=0;i<self._outputs.length; i++) {
                var c = self._outputs[i]._objVisir;
                var $comp = $("<component/>");
                var p = c.GetPos().Add(offp);
                $comp.text(c._type + " " + c._value + " " + p.x + " " + p.y + " " + c.GetRotation());
                $cirlist.append($comp);
            }
            // Save all components to the .xml equivalence for later
            return $("<root />").append($xml).html();
        }

        

        window._dbgGlobalBreadboard = this;
    }

    Breadboard.prototype.ClearComponentArrays = function () {
        this._notGate = [];
        this._andGate = [];
        this._orGate = [];
        this._xorGate = []; //***newly added */
        this._leds = [];
        this._outputs = [];
    }

    // Loads existing circuit from the .xml file
    Breadboard.prototype.LoadCircuit = function (circuit) {
        this.ClearComponentArrays();
        this._breadboard.LoadMyCircuit(circuit);
        this.Update();
    }
    
    // Saves current circuit to the .xml file
    Breadboard.prototype.SaveCircuit = function () {
        return this._breadboard.SaveCircuitWithOriginalWires();
    }

    // Visir contains a bunch of Instruments, which is unimportant here. We can hide these
    Breadboard.prototype._HideInstruments = function () {
        // this._$elem.find('.bin .teacher').hide();
        // this._$elem.find('.bin .reset').hide();
        this._$elem.find('.instrument.dmm').hide();
        this._$elem.find('.instrument.osc').hide();
        this._$elem.find('.instrument.fgen').hide();
        this._$elem.find('.instrument.gnd').hide();
    }

    // Initializes the power supply and voltage rails for the breadboard. We need +3.3V and GND
    Breadboard.prototype._AddPowerSupplies = function () {
        var connections2image = this._$elem.find('.instrument.dcpower img').attr('src');
        var rightPowerSupply = '<div class="instrument gnd" style="left: 586px; top: 398px"><div class="connectionimages"><img src="' + connections2image + '"></div><div class="texts"><div class="connectiontext">GND</div><div class="connectiontext">+3.3V</div></div></div>';
        this._$elem.find('.instruments').append($(rightPowerSupply));

        this._$elem.find('.instrument.dcpower').css({'top': '-46px'});
        this._$elem.find('.instrument.dcpower .title').hide();
        this._$elem.find('.instrument.dcpower .connectiontext:contains(6V)').text('+3.3V');
    }

    // Function to add existing components to the breadboard. Used for logic gates and switches
    Breadboard.prototype._AddComponents = function () {

        var switchesBottomLine = 10;

        // When we initialize, we can specify the number of switches that we would like
        for (var i = 0; i < this._numberOfSwitches; i++) {
            var bottomTopBase;
            var bottomLeftBase;
            var positionX;

            // Store information on where the switches should be located relative to the breadbaord
            if (i < switchesBottomLine) {
                var positionX = i;
                var bottomTopBase = 307;
                var bottomLeftBase = 157;
            } else {
                var positionX = i - switchesBottomLine;
                var bottomTopBase = 215;
                var bottomLeftBase = 170;
            }

            // Store information on the top position of each switch
            var topPosition;
            if (i % 2 == 1) {
                topPosition = bottomTopBase;
            } else {
                topPosition = bottomTopBase + 2 * VISIR_SQUARE_SIZE;
            }
            var leftPosition = bottomLeftBase + (VISIR_SQUARE_SIZE * 3) * positionX;
            var identifier = "switch" + i;
            var switchComponent = new Breadboard.Switch(identifier, this._imageBase, leftPosition, topPosition);
            // Add the switch information to the overall breadboard JSON, useful for debugging
            this._outputs.push(switchComponent);
            this.AddComponent(switchComponent);
        }
        
        // var jp1Image = this._imageBase + "connections_40.png";
        // var jp1 = new Breadboard.Component('JP1', 221, 22, jp1Image, null, 0);
        var jp1Image = this._imageBase + "de1_soc_connection.png";
        var jp1 = new Breadboard.Component('JP1', 192, 13, jp1Image, null, 0);
        this.AddComponent(jp1);
    }

    // Add a new component onto the breadboard, send it to the HTML
    Breadboard.prototype.AddComponent = function(component) {
        this._components[component._identifier] = component;
        this._$elem.find('.components').append(component._$elem);
        component.SetBreadboard(this);
    }

    Breadboard.prototype.SetErrorChecks = function(myBool) {
        this.allowErrorMessage = myBool;
    }

    Breadboard.prototype.GetErrorChecks = function() {
        return this.allowErrorMessage;
    }

    Breadboard.PinFinder = function () {
    }
    // Make sure to use your logic gates with dimensions 50 x 43 pixels
    Breadboard.PinFinder.prototype.FindGpioPin = function(point) {
        // Return a GPIO pin
        // Crucial to make sure that the GPIO is 13 pixels apart
        var factor = ((point.x - 229) / VISIR_SQUARE_SIZE); // 13 is the number of pixels between GPIO pin points
                                             // 229 is the distance between left wall and the left edge of the GPIO connector
        if (point.y == 55) { // bottom row (1..39)
            if (point.x >= 229 && point.x <= 543) {
                return Math.round((factor + 1) * 2) - 1;
            } 
        } else if (point.y == 42) { // upper row (2..40)
            if (point.x >= 229 && point.x <= 543) {
                return Math.round((factor + 1) * 2);
            } 
        }
        return null;
    }

    Breadboard.PinFinder.prototype.IsGround = function (point) {    // if it is one of the GND points in the BREADBOARD (not the connector)
        // If it is ground
        if (point.x >= 177 && point.x < 541) {
            if (point.y == 406 || point.y == 159) {
                return true;
            }
        }
        // Or the particular right ground
        if (point.y == 406 && point.x == 593) {
            return true;
        }
        // Or the particular left ground
        if (point.y == 159 && point.x == 112) {
            return true;
        }
        // Otherwise, it's not ground
        return false;
    }

    Breadboard.PinFinder.prototype.IsPower = function (point) {     // if it is one of the POWER points in the BREADBOARD (not the connector)
        // If it is power
        if (point.x >= 177 && point.x < 541) {
            if (point.y == 419 || point.y == 146) {
                return true;
            }
        }
        // Or the particular right power
        if (point.y == 419 && point.x == 593) {
            return true;
        }
        // Or the particular left power
        if (point.y == 146 && point.x == 112) {
            return true;
        }
        // Otherwise, it's not power
        return false;
    }

    Breadboard.Helper = function(){
        this.gpioCodeType = "g";
        this.literalCodeType = "L";      // May need to expand
        this.switchCodeType = "S";
        this.ledCodeType = "d";
        this.gateTypes = {
            "n": "not",
            "a": "and",
            "o": "or",
            "x": "xor"  //***newly added */
        };
    }

    Breadboard.Helper.prototype.NeedBuffer = function(code1, code2){
        if(code1.length < 1 || code2.length < 1){
            return;
        }
        if(code1[0] == this.gpioCodeType || code2[0] == this.gpioCodeType){
            return false;
        }
        if(code1[0] == this.literalCodeType || code2[0] == this.literalCodeType){
            return false;
        }
        if(code1[0] == this.switchCodeType || code2[0] == this.switchCodeType){
            return false;
        }
        if(code1[0] == this.ledCodeType || code1[0] == this.ledCodeType){
            return false;
        }
        return true;
    }

    Breadboard.Helper.prototype.ParseGate = function(code, pointPinNum) {
        if(code.length < 1){
            return;
        }
        if(code[0] == this.gpioCodeType){
            return [code, pointPinNum];
        }
        if(code[0] == this.literalCodeType){
            return [code, pointPinNum];
        }
        if(code[0] == this.switchCodeType){
            return [code, pointPinNum];
        }
        if(code[0] == this.ledCodeType){
            return [code, pointPinNum];
        }
        if(code[0] in this.gateTypes){
            return [this.gateTypes[code[0]], pointPinNum];
        }
        return [null, null];
    }

    Breadboard.SwitchStatus = function(){
        this.connectedToGround = false;
        this.connectedToPower = false;
    }

    Breadboard.LEDStatus = function(){
        this.connectedToGround = false;
    }

    Breadboard.NotStatus = function(){
        this.connectedToGround = false;
        this.connectedToPower = false;
        // this.originalGate = originalGate;

        this.gate1 = {
            "input": null,
            "output" : []
        };

        this.gate2 = {
            "input": null,
            "output" : []
        };

        this.gate3 = {
            "input": null,
            "output" : []
        };

        this.gate4 = {
            "input": null,
            "output" : []
        };

        this.gate5 = {
            "input": null,
            "output" : []
        };

        this.gate6 = {
            "input": null,
            "output" : []
        };

        this.gates = [this.gate1, this.gate2, this.gate3, this.gate4, this.gate5, this.gate6];
    }

    Breadboard.NotStatus.prototype.connectInput = function(inputPoint, whichGate){
        this.gates[whichGate]["input"] = inputPoint;
    }

    Breadboard.NotStatus.prototype.connectOutput = function(outputPoint, whichGate){
        this.gates[whichGate-1]["output"].push( outputPoint);
    }

    Breadboard.NotStatus.prototype.buildProtocolBlocks = function(errors) {
        if(!this.connectedToGround){
            errors.push(ERROR_MESSAGES["component-power"]);
            return [];
        }
        if(!this.connectedToPower){
            errors.push(ERROR_MESSAGES["component-power"]);
            return [];
        }

        var messages = [];
        $.each(this.gates, function(position, gate){
            if(gate["output"].length < 1){
                return;
            }
            if(gate["input"] == null){
                return; // TODO: will change later
            }
            if(gate["output"].length == 1){
                // only one output
                messages.push('n'+gate["input"]+gate["output"]);
            }
            else{
                var temp = 'n'+gate["input"];
                for(var i = 0; i < gate["output"].length; i++){
                    if(i < gate["output"].length - 1){
                        temp = temp + gate["output"][i] + ',';
                    }
                    else{
                        temp = temp + gate["output"][i];
                    }
                    
                }
                messages.push(temp);
            }
        });
        return messages;
    }

    Breadboard.QuadDualInputGateStatus = function(){
        this.connectedToGround = false;
        this.connectedToPower = false;
        // this.originalGate = originalGate;

        this.gate1 = {
            "input1": null,
            "input2": null,
            "output": []
        };

        this.gate2 = {
            "input1": null,
            "input2": null,
            "output": []
        };

        this.gate3 = {
            "input1": null,
            "input2": null,
            "output": []
        };

        this.gate4 = {
            "input1": null,
            "input2": null,
            "output": []
        };

        this.gates = [this.gate1, this.gate2, this.gate3, this.gate4];
    }

    Breadboard.QuadDualInputGateStatus.prototype.connectInput = function(inputPoint, whichGate, whichInput){
        this.gates[whichGate-1]["input"+whichInput.toString()] = inputPoint;
    }

    Breadboard.QuadDualInputGateStatus.prototype.connectOutput = function(outputPoint, whichGate){
        this.gates[whichGate-1]["output"].push(outputPoint);
    }

    Breadboard.QuadDualInputGateStatus.prototype.buildProtocolBlocks = function(errors){
        if(!this.connectedToGround){
            errors.push(ERROR_MESSAGES["component-power"]);
            return [];
        }
        if(!this.connectedToPower){
            errors.push(ERROR_MESSAGES["component-power"]);
            return [];
        }

        var messages = [];
        var logicGateCodeName = this.getLogicGateCodeName();
        $.each(this.gates, function(position, gate){
            if(gate["output"].length < 1){
                return;
            }
            if(gate["input1"] == null || gate["input2"] == null){
                return; // TODO: will change later
            }
            if(gate["output"].length == 1){
                // only one output
                messages.push(logicGateCodeName+gate["input1"]+gate["input2"]+gate["output"]);
            }
            else{
                var temp = logicGateCodeName+gate["input1"]+gate["input2"];
                for(var i = 0; i < gate["output"].length; i++){
                    if(i < gate["output"].length - 1){
                        temp = temp + gate["output"][i] + ',';
                    }
                    else{
                        temp = temp + gate["output"][i];
                    }
                    
                }
                messages.push(temp);
            }
            
        });
        return messages;
    }

    Breadboard.AndStatus = function(){
        Breadboard.AndStatus.parent.constructor.apply(this)
    }

    extend(Breadboard.AndStatus, Breadboard.QuadDualInputGateStatus);

    Breadboard.AndStatus.prototype.getLogicGateCodeName = function(){
        return "a";
    }

    Breadboard.OrStatus = function(){
        Breadboard.OrStatus.parent.constructor.apply(this)
    }

    extend(Breadboard.OrStatus, Breadboard.QuadDualInputGateStatus);

    Breadboard.OrStatus.prototype.getLogicGateCodeName = function(){
        return "o";
    }

    //***newly added */
    Breadboard.XorStatus = function(){
        Breadboard.XorStatus.parent.constructor.apply(this)
    }

    extend(Breadboard.XorStatus, Breadboard.QuadDualInputGateStatus);

    Breadboard.XorStatus.prototype.getLogicGateCodeName = function(){
        return "x";
    }

    Breadboard.prototype.checkLEDConnection = function(errors){
        var _leds = this._leds;
        var _notGate = this._notGate;
        var _andGate = this._andGate;
        var _orGate = this._orGate;
        var _xorGate = this._xorGate;       //***newly added */
        var _switches = this._outputs;
        for(var i = 0; i < _leds.length; i++){
            var ledPos = {};
            ledPos.x = _leds[i].GetWireX();
            ledPos.y = _leds[i].GetWireYBase();
            var checkGate = null;
            for(var ii = 0; ii < _notGate.length; ii++){
                checkGate = _notGate[ii].CheckIfInput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
                checkGate = _notGate[ii].CheckIfOutput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
            }
            checkGate = null;
            for(var ii = 0; ii < _andGate.length; ii++){
                checkGate = _andGate[ii].CheckIfInput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
                checkGate = _andGate[ii].CheckIfOutput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
            }
            checkGate = null;
            for(var ii = 0; ii < _orGate.length; ii++){
                checkGate = _orGate[ii].CheckIfInput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
                checkGate = _orGate[ii].CheckIfOutput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
            }
            //***newly added */
            checkGate = null;
            for(var ii = 0; ii < _xorGate.length; ii++){
                checkGate = _xorGate[ii].CheckIfInput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
                checkGate = _xorGate[ii].CheckIfOutput(ledPos);
                if(checkGate[0] === true){
                    errors.push(ERROR_MESSAGES["led-position"]);
                    return;
                }
            }
            for(var ii = 0; ii < _switches.length; ii++){
                var wireX = _switches[ii].GetWireX();
                var wireYBase = _switches[ii].GetWireYBase();
                if(ledPos.y >= wireYBase && ledPos.y <= (wireYBase + 4*VISIR_SQUARE_SIZE)){
                    if(ledPos.x === wireX){
                        errors.push(ERROR_MESSAGES["led-position"]);
                        return;
                    }
                }
            }
        }
    }

    // Big function in the javascript code, used to update the entirely of the breadboard layout
    Breadboard.prototype.Update = function() {
        // Initialize self variables used for checking throughout the update process
        console.log("Updating...");
        // console.log(this);
        var myString = this.CalculateWiringProtocolMessage();
        // console.log(myString);
        if(myString.includes("Error")){
            if(this.GetErrorChecks()){
                document.getElementById("protocol").innerHTML = myString;
            }
            
        }
        else{
            if(this.GetErrorChecks()){
                document.getElementById("protocol").innerHTML = ERROR_MESSAGES["ready"];
            }
        }
        return myString;
    }

    Breadboard.prototype.CalculateWiringProtocolMessage = function(){
        // Run through different wires
        var finder = new Breadboard.PinFinder();
        var helper = new Breadboard.Helper();
        
        
        
        var componentStatus = {};
        var errors = [];
        var changedSwitches = [];
        var switchStatus = [];
        var ledStatus = [];
        var wires = this._breadboard._wires;
        var bufferCounter = 0;

        for(var i = 0; i < this._leds.length; i++){
            var ledStat = new Breadboard.LEDStatus();
            ledStatus.push(ledStat);
        }
        for(var i = 0; i < this._outputs.length; i++){
            var switchStat = new Breadboard.SwitchStatus();
            switchStatus.push(switchStat);
        }

        var _notGate = this._notGate;
        componentStatus.notStatus = [];
        for(var i = 0; i < _notGate.length; i++){
            _notGate[i].GetPinLocation();
            if(_notGate[i]._topPosition != 261){
                errors.push(ERROR_MESSAGES["component-placement"]);
            }
            var notStatus = new Breadboard.NotStatus();
            componentStatus.notStatus.push(notStatus);
        }
        var _andGate = this._andGate;
        componentStatus.andStatus = [];
        for(var i = 0; i < _andGate.length; i++){
            _andGate[i].GetPinLocation();
            if(_andGate[i]._topPosition != 261){
                errors.push(ERROR_MESSAGES["component-placement"]);
            }
            var andStatus = new Breadboard.AndStatus();
            componentStatus.andStatus.push(andStatus);
        }
        var _orGate = this._orGate;
        componentStatus.orStatus = [];
        for(var i = 0; i < _orGate.length; i++){
            _orGate[i].GetPinLocation();
            if(_orGate[i]._topPosition != 261){
                errors.push(ERROR_MESSAGES["component-placement"]);
            }
            var orStatus = new Breadboard.OrStatus();
            componentStatus.orStatus.push(orStatus);
        }
        //***newly added */
        var _xorGate = this._xorGate;
        componentStatus.xorStatus = [];
        for(var i = 0; i < _xorGate.length; i++){
            _xorGate[i].GetPinLocation();
            if(_xorGate[i]._topPosition != 261){
                errors.push(ERROR_MESSAGES["component-placement"]);
            }
            var xorStatus = new Breadboard.XorStatus();
            componentStatus.xorStatus.push(xorStatus);
        }

        var nonGateLeftovers = [];
        var _leds = this._leds;
        this.checkLEDConnection(errors);

        // console.log(componentStatus);

        for (var i = this._originalNumberOfWires; i < wires.length; i++) {
        // for (var i = 10; i < wires.length; i++) {
            var componentCounterNot1 = 0;
            var componentCounterAnd1 = 0;
            var componentCounterOr1 = 0;
            var componentCounterXor1 = 0; //***newly added */
            var componentCounterNot2 = 0;
            var componentCounterAnd2 = 0;
            var componentCounterOr2 = 0;
            var componentCounterXor2 = 0; //***newly added */
            var componentCounterLocal = 0;
            // Sweep through the different wires
            var wire = wires[i];
            var point1 = wire._start;
            var point2 = wire._end;
            
            // ignore the blank points
            if(point1.x == point2.x && point1.y == point2.y){
                continue;
            }

            // check if point1 is a virtual output or a virtual input
            var point1IsOutput = null;
            // check input:
            // - check if output of FPGA, inputs to logic gate
            var gpioPin = finder.FindGpioPin(point1);
            var isVirtualInput = INPUTS_BY_PIN[gpioPin] !== undefined;
            var point1Code = "";
            if(isVirtualInput){
                // gpioPin = Object.keys(INPUTS_BY_PIN).indexOf(gpioPin.toString());
                gpioPin = INPUTS_BY_PIN_ARRAY.indexOf(gpioPin);
                point1IsOutput = false;
                if(gpioPin < 10){
                    // i.e. g07 or g09. Add a '0' string to have 2 numbers after g
                    point1Code = "g" + "0" + gpioPin.toString();
                }
                else{
                    // i.e. g17 or g31. Will always have 2 numbers after g
                    point1Code = "g" + gpioPin.toString();
                }
            }
            var notPinInput = [false, -1]; // if in gate, gate location
            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPinInput = gate.CheckIfInput(point1);
                if(notPinInput[0]){
                    componentCounterNot1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            var inputPoint1GateNum = -1;
            var inputPoint1InputNum = 1;
            if(notPinInput[0]){
                point1IsOutput = false;
                inputPoint1GateNum = notPinInput[1];
                point1Code = "n";
            }
            var andPinInput = [false, -1, -1]; // if in gate, gate location, input num
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPinInput = gate.CheckIfInput(point1);
                if(andPinInput[0]){
                    componentCounterAnd1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPinInput[0]){
                point1IsOutput = false;
                inputPoint1GateNum = andPinInput[1];
                inputPoint1InputNum = andPinInput[2];
                point1Code = "a";
            }
            var orPinInput = [false, -1, -1]; // if in gate, gate location, input num
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPinInput = gate.CheckIfInput(point1);
                if(orPinInput[0]){
                    componentCounterOr1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPinInput[0]){
                point1IsOutput = false;
                inputPoint1GateNum = orPinInput[1];
                inputPoint1InputNum = orPinInput[2];
                point1Code = "o";
            }
            //***newly added */
            var xorPinInput = [false, -1, -1]; // if in gate, gate location, input num
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPinInput = gate.CheckIfInput(point1);
                if(xorPinInput[0]){
                    componentCounterXor1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPinInput[0]){
                point1IsOutput = false;
                inputPoint1GateNum = xorPinInput[1];
                inputPoint1InputNum = xorPinInput[2];
                point1Code = "x";
            }
            var ledCount = 0;
            $.each(_leds, function(pos, led){
                var wireX = led.GetWireX();
                var wireY = led.GetWireYBase();
                // check if led is on top half or bottom half
                if(point1.x === wireX){
                    if(led._onTopHalf){
                        if((point1.y - wireY) <= 4*VISIR_SQUARE_SIZE){
                            if((led._vertical && (point1.y - wireY) >= 0) || (!led._vertical && point1.y <= 271 && point1.y > 271 - 5*VISIR_SQUARE_SIZE)){
                                //success
                                point1IsOutput = false;
                                point1Code = "d" + ledCount.toString();
                                return false;
                            }
                        }
                    }
                    else{
                        if((wireY - point1.y) <= 4*VISIR_SQUARE_SIZE){
                            if((led._vertical && (wireY - point1.y) >= 0) || (!led._vertical && point1.y >= 300 && point1.y < 300 + 5*VISIR_SQUARE_SIZE)){
                                //success
                                point1IsOutput = false;
                                point1Code = "d" + ledCount.toString();
                                return false;
                            }
                        }
                    }
                }
                ledCount++;
            });

            // check output:
            // - check if output of switch, or Power or GND, or output of a logic gate, or output of GPIO
            if(finder.IsPower(point1)){
                point1IsOutput = true;
                point1Code = "LT";
            }
            else if(finder.IsGround(point1)){
                point1IsOutput = true;
                point1Code = "LF";
            }
            var isVirtualOutput = OUTPUTS_BY_PIN[gpioPin] !== undefined;
            if(isVirtualOutput){
                // gpioPin = Object.keys(OUTPUTS_BY_PIN).indexOf(gpioPin.toString());
                gpioPin = OUTPUTS_BY_PIN_ARRAY.indexOf(gpioPin);
                point1IsOutput = true;
                if(gpioPin < 10){
                    // i.e. g07 or g09. Add a '0' string to have 2 numbers after g
                    point1Code = "g" + "0" + gpioPin.toString();
                }
                else{
                    // i.e. g17 or g31. Will always have 2 numbers after g
                    point1Code = "g" + gpioPin.toString();
                }
            }
            // check if connected to a switch
            var i_p = 0;
            $.each(this._outputs, function(pos, eachSwitch){
                var wireX = eachSwitch.GetWireX();
                var wireYBase = eachSwitch.GetWireYBase();
                if(point1.y >= wireYBase && point1.y <= (wireYBase + 4*VISIR_SQUARE_SIZE)){
                    if(point1.x === wireX){
                        // switch found
                        point1IsOutput = true;
                        if(eachSwitch._value){
                            point1Code = "ST";
                            // point1Code = "SW" + i_p.toString();
                        }
                        else{
                            point1Code = "SF";
                            // point1Code = "SW" + i_p.toString();
                        }

                        if(eachSwitch._valueChanged){
                            changedSwitches.push("SW"+i_p.toString());
                            eachSwitch._valueChanged = false;
                        }
                        return false;
                    }
                }
                i_p++;
            });
            var notPinOutput = [false, -1]; // if in gate, gate num
            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPinOutput = gate.CheckIfOutput(point1);
                if(notPinOutput[0]){
                    componentCounterNot1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            var outputPoint1GateNum = -1;
            if(notPinOutput[0]){
                point1IsOutput = true;
                outputPoint1GateNum = notPinOutput[1];
                point1Code = "n";
            }
            var andPinOutput = [false, -1]; // if in gate, gate num
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPinOutput = gate.CheckIfOutput(point1);
                if(andPinOutput[0]){
                    componentCounterAnd1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPinOutput[0]){
                point1IsOutput = true;
                outputPoint1GateNum = andPinOutput[1];
                point1Code = "a";
            }
            var orPinOutput = [false, -1]; // if in gate, gate num
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPinOutput = gate.CheckIfOutput(point1);
                if(orPinOutput[0]){
                    componentCounterOr1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPinOutput[0]){
                point1IsOutput = true;
                outputPoint1GateNum = orPinOutput[1];
                point1Code = "o";
            }
            //***newly added */
            var xorPinOutput = [false, -1]; // if in gate, gate num
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPinOutput = gate.CheckIfOutput(point1);
                if(xorPinOutput[0]){
                    componentCounterXor1 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPinOutput[0]){
                point1IsOutput = true;
                outputPoint1GateNum = xorPinOutput[1];
                point1Code = "x";
            }
            // ======================= Marks the end of Point 1 =================================
            // ======================= Marks the start of Point 2 ===============================
            // check if point2 is a virtual output or a virtual input
            var point2IsOutput = null;
            var point2Code = "";
            // check input:
            // - check if output of FPGA, inputs to logic gate
            gpioPin = finder.FindGpioPin(point2);
            isVirtualInput = INPUTS_BY_PIN[gpioPin] !== undefined;
            if(isVirtualInput){
                // gpioPin = Object.keys(INPUTS_BY_PIN).indexOf(gpioPin.toString());
                gpioPin = INPUTS_BY_PIN_ARRAY.indexOf(gpioPin);
                point2IsOutput = false;
                if(gpioPin < 10){
                    // i.e. g07 or g09. Add a '0' string to have 2 numbers after g
                    point2Code = "g" + "0" + gpioPin.toString();
                }
                else{
                    // i.e. g17 or g31. Will always have 2 numbers after g
                    point2Code = "g" + gpioPin.toString();
                }
                
            }
            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPinInput = gate.CheckIfInput(point2);
                if(notPinInput[0]){
                    componentCounterNot2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            var inputPoint2GateNum = -1;
            var inputPoint2InputNum = 1;
            if(notPinInput[0]){
                point2IsOutput = false;
                inputPoint2GateNum = notPinInput[1];
                point2Code = "n";
            }
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPinInput = gate.CheckIfInput(point2);
                if(andPinInput[0]){
                    componentCounterAnd2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPinInput[0]){
                point2IsOutput = false;
                inputPoint2GateNum = andPinInput[1];
                inputPoint2InputNum = andPinInput[2];
                point2Code = "a";
            }
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPinInput = gate.CheckIfInput(point2);
                if(orPinInput[0]){
                    componentCounterOr2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPinInput[0]){
                point2IsOutput = false;
                inputPoint2GateNum = orPinInput[1];
                inputPoint2InputNum = orPinInput[2];
                point2Code = "o";
            }
            //***newly added */
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPinInput = gate.CheckIfInput(point2);
                if(xorPinInput[0]){
                    componentCounterXor2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPinInput[0]){
                point2IsOutput = false;
                inputPoint2GateNum = xorPinInput[1];
                inputPoint2InputNum = xorPinInput[2];
                point2Code = "x";
            }
            ledCount = 0;
            $.each(_leds, function(pos, led){
                var wireX = led.GetWireX();
                var wireY = led.GetWireYBase();
                // check if led is on top half or bottom half
                if(point2.x === wireX){
                    if(led._onTopHalf){
                        if((point2.y - wireY) <= 4*VISIR_SQUARE_SIZE){
                            if((led._vertical && (point2.y - wireY) >= 0) || (!led._vertical && point2.y <= 271 && point2.y > 271 - 5*VISIR_SQUARE_SIZE)){
                                //success
                                point2IsOutput = false;
                                point2Code = "d" + ledCount.toString();
                                return false;
                            }
                        }
                    }
                    else{
                        if((wireY - point2.y) <= 4*VISIR_SQUARE_SIZE){
                            if((led._vertical && (wireY - point2.y) >= 0) || (!led._vertical && point2.y >= 300 && point2.y < 300 + 5*VISIR_SQUARE_SIZE)){
                                //success
                                point2IsOutput = false;
                                point2Code = "d" + ledCount.toString();
                                return false;
                            }
                        }
                    }
                }
                ledCount++;
            });

            // check output:
            // - check if output of switch, or Power or GND, or output of a logic gate, or output of GPIO
            if(finder.IsPower(point2)){
                point2IsOutput = true;
                point2Code = "LT";
            }
            else if(finder.IsGround(point2)){
                point2IsOutput = true;
                point2Code = "LF";
            }
            isVirtualOutput = OUTPUTS_BY_PIN[gpioPin] !== undefined;
            if(isVirtualOutput){
                // gpioPin = Object.keys(OUTPUTS_BY_PIN).indexOf(gpioPin.toString());
                gpioPin = OUTPUTS_BY_PIN_ARRAY.indexOf(gpioPin);
                point2IsOutput = true;
                if(gpioPin < 10){
                    // i.e. g07 or g09. Add a '0' string to have 2 numbers after g
                    point2Code = "g" + "0" + gpioPin.toString();
                }
                else{
                    // i.e. g17 or g31. Will always have 2 numbers after g
                    point2Code = "g" + gpioPin.toString();
                }
            }
            // check if connected to a switch
            i_p = 0;
            $.each(this._outputs, function(pos, eachSwitch){
                var wireX = eachSwitch.GetWireX();
                var wireYBase = eachSwitch.GetWireYBase();
                if(point2.y >= wireYBase && point2.y <= (wireYBase + 4*VISIR_SQUARE_SIZE)){
                    if(point2.x === wireX){
                        // switch found
                        point2IsOutput = true;
                        if(eachSwitch._value){
                            point2Code = "ST";
                            // point2Code = "SW" + i_p.toString();
                        }
                        else{
                            point2Code = "SF";
                            // point2Code = "SW" + i_p.toString();
                        }

                        if(eachSwitch._valueChanged){
                            changedSwitches.push("SW"+i_p.toString());
                            eachSwitch._valueChanged = false;
                        }
                        return false;
                    }
                }
            });
            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPinOutput = gate.CheckIfOutput(point2);
                if(notPinOutput[0]){
                    componentCounterNot2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            var outputPoint2GateNum = -1;
            if(notPinOutput[0]){
                point2IsOutput = true;
                outputPoint2GateNum = notPinOutput[1];
                point2Code = "n";
            }
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPinOutput = gate.CheckIfOutput(point2);
                if(andPinOutput[0]){
                    componentCounterAnd2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPinOutput[0]){
                point2IsOutput = true;
                outputPoint2GateNum = andPinOutput[1];
                point2Code = "a";
            }
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPinOutput = gate.CheckIfOutput(point2);
                if(orPinOutput[0]){
                    componentCounterOr2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPinOutput[0]){
                point2IsOutput = true;
                outputPoint2GateNum = orPinOutput[1];
                point2Code = "o";
            }
            //***newly added */
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPinOutput = gate.CheckIfOutput(point2);
                if(xorPinOutput[0]){
                    componentCounterXor2 = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPinOutput[0]){
                point2IsOutput = true;
                outputPoint2GateNum = xorPinOutput[1];
                point2Code = "x";
            }

            // Check to see if gates are properly powered
            // not gate
            componentCounterLocal = 0;
            var componentCounterLED = 0;
            var componentCounterSwitch = 0;
            var componentCounterNot = 0;
            var componentCounterAnd = 0;
            var componentCounterOr = 0;
            var componentCounterXor = 0; //***newly added */
            var notPowered = null;
            // check point 1
            var ledGrounded = [null, null];
            $.each(this._leds, function(pos, led){
                ledGrounded = led.checkIfGround(point1);
                if(ledGrounded[0] != null){
                    componentCounterLED = componentCounterLocal;
                    if(ledGrounded[1] == true){
                        return false
                    }
                    else{
                        if(ledGrounded[0] === false && ledGrounded[1] === false){
                            ledStatus[componentCounterLED].connectedToGround = true;
                        }
                    }
                }
                componentCounterLocal += 1;
            });
            if(ledGrounded[0] === false && ledGrounded[1] === true && finder.IsGround(point2)){
                ledStatus[componentCounterLED].connectedToGround = true;
                continue;
            }
            // check point 2
            ledGrounded = [null, null];
            componentCounterLocal = 0;
            $.each(this._leds, function(pos, led){
                ledGrounded = led.checkIfGround(point2);
                if(ledGrounded[0] != null){
                    componentCounterLED = componentCounterLocal;
                    if(ledGrounded[1] == true){
                        return false
                    }
                    else{
                        if(ledGrounded[0] === false && ledGrounded[1] === false){
                            ledStatus[componentCounterLED].connectedToGround = true;
                        }
                    }
                }
                componentCounterLocal += 1;
            });
            if(ledGrounded[0] === false && ledGrounded[1] && finder.IsGround(point1)){
                ledStatus[componentCounterLED].connectedToGround = true;
                continue;
            }

            var switchPowered = null;
            componentCounterLocal = 0;
            $.each(this._outputs, function(pos, sw){
                switchPowered = sw.checkIfPowered(point1);
                if(switchPowered != null){
                    componentCounterSwitch = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(switchPowered === true && finder.IsPower(point2)){
                switchStatus[componentCounterSwitch].connectedToPower = true;
                continue;
            }
            else if(switchPowered === false && finder.IsGround(point2)){
                switchStatus[componentCounterSwitch].connectedToGround = true;
                continue;
            }
            // check point 2
            switchPowered = null;
            componentCounterLocal = 0;
            $.each(this._outputs, function(pos, sw){
                switchPowered = sw.checkIfPowered(point2);
                if(switchPowered != null){
                    componentCounterSwitch = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(switchPowered === true && finder.IsPower(point1)){
                switchStatus[componentCounterSwitch].connectedToPower = true;
                continue;
            }
            else if(switchPowered === false && finder.IsGround(point1)){
                switchStatus[componentCounterSwitch].connectedToGround = true;
                continue;
            }

            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPowered = gate.CheckIfPower(point1);
                if(notPowered != null){
                    componentCounterNot = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(notPowered === true && finder.IsPower(point2)){
                componentStatus.notStatus[componentCounterNot].connectedToPower = true;
                continue;
            }
            else if(notPowered === false && finder.IsGround(point2)){
                componentStatus.notStatus[componentCounterNot].connectedToGround = true;
                continue;
            }
            // check point 2
            notPowered = null;
            componentCounterLocal = 0;
            $.each(_notGate, function(pos, gate){
                notPowered = gate.CheckIfPower(point2);
                if(notPowered != null){
                    componentCounterNot = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(notPowered === true && finder.IsPower(point1)){
                componentStatus.notStatus[componentCounterNot].connectedToPower = true;
                continue;
            }
            else if(notPowered === false && finder.IsGround(point1)){
                componentStatus.notStatus[componentCounterNot].connectedToGround = true;
                continue;
            }

            // and gate
            // point 1 is on gate
            var andPowered = null;
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPowered = gate.CheckIfPower(point1);
                if(andPowered != null){
                    componentCounterAnd = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPowered === true && finder.IsPower(point2)){
                componentStatus.andStatus[componentCounterAnd].connectedToPower = true;
                continue;
            }
            else if(andPowered === false && finder.IsGround(point2)){
                componentStatus.andStatus[componentCounterAnd].connectedToGround = true;
                continue;
            }
            // point 2 is on gate
            andPowered = null;
            componentCounterLocal = 0;
            $.each(_andGate, function(pos, gate){
                andPowered = gate.CheckIfPower(point2);
                if(andPowered != null){
                    componentCounterAnd = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(andPowered === true && finder.IsPower(point1)){
                componentStatus.andStatus[componentCounterAnd].connectedToPower = true;
                continue;
            }
            else if(andPowered === false && finder.IsGround(point1)){
                componentStatus.andStatus[componentCounterAnd].connectedToGround = true;
                continue;
            }

            // or gate
            var orPowered = null;
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPowered = gate.CheckIfPower(point1);
                if(orPowered != null){
                    componentCounterOr = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPowered === true && finder.IsPower(point2)){
                componentStatus.orStatus[componentCounterOr].connectedToPower = true;
                continue;
            }
            else if(orPowered === false && finder.IsGround(point2)){
                componentStatus.orStatus[componentCounterOr].connectedToGround = true;
                continue;
            }
            // point 2 is on gate
            orPowered = null;
            componentCounterLocal = 0;
            $.each(_orGate, function(pos, gate){
                orPowered = gate.CheckIfPower(point2);
                if(orPowered != null){
                    componentCounterOr = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(orPowered === true && finder.IsPower(point1)){
                componentStatus.orStatus[componentCounterOr].connectedToPower = true;
                continue;
            }
            else if(orPowered === false && finder.IsGround(point1)){
                componentStatus.orStatus[componentCounterOr].connectedToGround = true;
                continue;
            }

            //***newly added */
            // xor gate
            var xorPowered = null;
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPowered = gate.CheckIfPower(point1);
                if(xorPowered != null){
                    componentCounterXor = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPowered === true && finder.IsPower(point2)){
                componentStatus.xorStatus[componentCounterXor].connectedToPower = true;
                continue;
            }
            else if(xorPowered === false && finder.IsGround(point2)){
                componentStatus.xorStatus[componentCounterXor].connectedToGround = true;
                continue;
            }
            // point 2 is on gate
            xorPowered = null;
            componentCounterLocal = 0;
            $.each(_xorGate, function(pos, gate){
                xorPowered = gate.CheckIfPower(point2);
                if(xorPowered != null){
                    componentCounterXor = componentCounterLocal;
                    return false;
                }
                componentCounterLocal += 1;
            });
            if(xorPowered === true && finder.IsPower(point1)){
                componentStatus.xorStatus[componentCounterXor].connectedToPower = true;
                continue;
            }
            else if(xorPowered === false && finder.IsGround(point1)){
                componentStatus.xorStatus[componentCounterXor].connectedToGround = true;
                continue;
            }

            var inputPoint;
            var inputPointPinNum;
            var outputPoint;
            var outputPointPinNum;
            var newPoint1Code;
            var newPoint2Code;
            var point1InputNum;
            var point2InputNum;
            if(point1IsOutput == null || point2IsOutput == null){
                errors.push(ERROR_MESSAGES["null"]);
                console.log(ERROR_MESSAGES["null"]);
            }

            if(!point1IsOutput && point2IsOutput){
                // virtual input connection to virtual output -> VALID
                inputPoint = point1;
                inputPointPinNum = inputPoint1GateNum;
                newPoint1Code = point1Code;
                outputPoint = point2;
                outputPointPinNum = outputPoint2GateNum;
                newPoint2Code = point2Code;
                point1InputNum = inputPoint1InputNum;
                point2InputNum = inputPoint2InputNum;
            }
            else if(point1IsOutput && !point2IsOutput){
                // virtual input connection to virtual output -> VALID
                inputPoint = point2;
                inputPointPinNum = inputPoint2GateNum;
                newPoint1Code = point2Code;
                outputPoint = point1;
                outputPointPinNum = outputPoint1GateNum;
                newPoint2Code = point1Code;
                point1InputNum = inputPoint2InputNum;
                point2InputNum = inputPoint1InputNum;
                var tempNot = componentCounterNot1;
                var tempAnd = componentCounterAnd1;
                var tempOr = componentCounterOr1;
                var tempXor = componentCounterXor1; //***newly added */
                componentCounterNot1 = componentCounterNot2;
                componentCounterAnd1 = componentCounterAnd2;
                componentCounterOr1 = componentCounterOr2;
                componentCounterXor1 = componentCounterXor2; //***newly added */
                componentCounterNot2 = tempNot;
                componentCounterAnd2 = tempAnd;
                componentCounterOr2 = tempOr;
                componentCounterXor2 = tempXor; //***newly added */
            }
            else if(!point1IsOutput && !point2IsOutput){
                // both are inputs. For now, we will return error
                errors.push(ERROR_MESSAGES["inputs"]);
                console.log(ERROR_MESSAGES["inputs"]);
            }
            else{
                // both are outputs. Also error
                errors.push(ERROR_MESSAGES["outputs"]);
                console.log(ERROR_MESSAGES["outputs"]);
            }

            if(errors.length > 0){
                return errors[0];
            }
            // From this point on, we know that circuit is now within the valid state

            // point1Code: g17, T, F, n, ST
            // inputPointPinNum = gate number (only if point1Code is n)
            // outputPointPinNum = gate number (only if point1Code is n)
            var leftOversMessage = "";
            // Check if needs buffer
            var needsBuffer = helper.NeedBuffer(newPoint1Code, newPoint2Code);
            if(needsBuffer){
                var whatGate = helper.ParseGate(newPoint1Code, inputPointPinNum);
                if(whatGate[0] != null){
                    if(whatGate[0] == "not"){
                        componentStatus.notStatus[componentCounterNot1].connectInput("b"+bufferCounter, whatGate[1]);
                    }
                    else if(whatGate[0] == "and"){
                        componentStatus.andStatus[componentCounterAnd1].connectInput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                    else if(whatGate[0] == "or"){
                        componentStatus.orStatus[componentCounterOr1].connectInput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                    //***newly added */
                    else if(whatGate[0] == "xor"){
                        componentStatus.xorStatus[componentCounterXor1].connectInput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                }
                whatGate = helper.ParseGate(newPoint2Code, outputPointPinNum);
                if(whatGate[0] != null){
                    if(whatGate[0] == "not"){
                        componentStatus.notStatus[componentCounterNot2].connectOutput("b"+bufferCounter, whatGate[1]);
                    }
                    else if(whatGate[0] == "and"){
                        componentStatus.andStatus[componentCounterAnd2].connectOutput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                    else if(whatGate[0] == "or"){
                        componentStatus.orStatus[componentCounterOr2].connectOutput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                    //***newly added */
                    else if(whatGate[0] == "xor"){
                        componentStatus.xorStatus[componentCounterXor2].connectOutput("b"+bufferCounter, whatGate[1], point1InputNum);
                        
                    }
                }
                bufferCounter += 1;
            }
            else{
                // Don't need the buffer
                var whatGate = helper.ParseGate(newPoint1Code, inputPointPinNum);
                // console.log(whatGate);
                if(whatGate[0] != null){
                    if(whatGate[0] == "not"){
                        componentStatus.notStatus[componentCounterNot1].connectInput(newPoint2Code, whatGate[1]);
                    }
                    else if(whatGate[0] == "and"){
                        componentStatus.andStatus[componentCounterAnd1].connectInput(newPoint2Code, whatGate[1], point1InputNum);
                    }
                    else if(whatGate[0] == "or"){
                        componentStatus.orStatus[componentCounterOr1].connectInput(newPoint2Code, whatGate[1], point1InputNum);
                    }
                    //***newly added */
                    else if(whatGate[0] == "xor"){
                        componentStatus.xorStatus[componentCounterXor1].connectInput(newPoint2Code, whatGate[1], point1InputNum);
                    }
                    else{
                        // not a gate
                        leftOversMessage = "y" + newPoint2Code;
                    }
                }
                
                whatGate = helper.ParseGate(newPoint2Code, outputPointPinNum);
                // console.log(whatGate);
                if(whatGate[0] != null){
                    if(whatGate[0] == "not"){
                        componentStatus.notStatus[componentCounterNot2].connectOutput(newPoint1Code, whatGate[1]);
                    }
                    else if(whatGate[0] == "and"){
                        componentStatus.andStatus[componentCounterAnd2].connectOutput(newPoint1Code, whatGate[1]);
                    }
                    else if(whatGate[0] == "or"){
                        componentStatus.orStatus[componentCounterOr2].connectOutput(newPoint1Code, whatGate[1]);
                    }
                    //***newly added */
                    else if(whatGate[0] == "xor"){
                        componentStatus.xorStatus[componentCounterXor2].connectOutput(newPoint1Code, whatGate[1]);
                    }
                    else{
                        // only append to the end portion if the first part was also called
                        if(leftOversMessage){
                            leftOversMessage += newPoint1Code;
                            nonGateLeftovers.push(leftOversMessage);
                        }
                        
                    }

                }
            }

        }
        for(var i = 0; i < switchStatus.length; i++){
            if(switchStatus[i].connectedToGround == false || switchStatus[i].connectedToPower == false){
                errors.push(ERROR_MESSAGES["switches"]);
                console.log(ERROR_MESSAGES["switches"]);
            }
        }
        for(var i = 0; i < ledStatus.length; i++){
            if(ledStatus[i].connectedToGround == false){
                errors.push(ERROR_MESSAGES["leds"]);
                console.log(ERROR_MESSAGES["leds"]);
            }
        }

        var messages = [];
        $.each(componentStatus, function(pos, particularComponentStatus){
            $.each(particularComponentStatus, function(pos, gate){
                var currentMessages = gate.buildProtocolBlocks(errors);
                for(var i = 0; i < currentMessages.length; i++){
                    var currentMessage = currentMessages[i];
                    if(!messages.includes(currentMessage)){
                        messages.push(currentMessage);
                    } 
                }
            });
        });

        if(errors.length > 0){
            return errors[0];
        }
        
        var wiringProtocolMessage = messages.join(";");
        if(nonGateLeftovers){
            if(wiringProtocolMessage){
                wiringProtocolMessage += ";";
            }
            wiringProtocolMessage += nonGateLeftovers.join(";");
        }
        wiringProtocolMessage = wiringProtocolMessage + "\n";
        // console.log(changedSwitches);
        // if(changedSwitches.length){
        //     wiringProtocolMessage += "\t\n" + changedSwitches.join(";");
        //     wiringProtocolMessage += "\n";
        // }
        return wiringProtocolMessage;

    }

    // The defintion of each component in the function, called in the template.html to initialize the breadboard
    Breadboard.Component = function (identifier, leftPosition, topPosition, image1, image2, zIndex) {
        this._breadboard = null;
        this._identifier = identifier;
        this._leftPosition = parseInt(leftPosition);
        this._topPosition = parseInt(topPosition);
        // grab a new <div> to put on the webpage
        this._$elem = $("<div id='" + identifier + "'></div>");
        this._$elem.addClass("component");
        this._$elem.css({'left': parseInt(leftPosition) + 'px', 'top': parseInt(topPosition) + 'px'});
        // Link the CSS file to the appropraite div
        if (zIndex !== undefined) {
            this._$elem.css({'z-index': 0});
        }
        // Add in the appropriate images to the breadboard
        this._$elem.append($("<img class='active image1' src='" + image1 + "' draggable='false'>"));
        if (image2) {
            this._$elem.append($("<img class='image2' src='" + image2 + "' draggable='false'>"));
        }
    }

    Breadboard.Component.prototype.SetBreadboard = function(breadboard) {
        this._breadboard = breadboard;
    }

    Breadboard.LEDs = function(identifier, imageBase, leftPosition, topPosition, visirObj) {
        var self = this;
        
        this._objVisir = visirObj;
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1, image2);
        this._vertical = this._objVisir.translation.rot == "0"
        this._value = false;
        this._onTopHalf = false;
        if(topPosition < 261){
            this._onTopHalf = true;
        }

        this._value = false;
    }

    Breadboard.LEDs.prototype = Object.create(Breadboard.Component.prototype);

    // change the output state of the switch, triggered upon each user click
    Breadboard.LEDs.prototype._Change = function (ledValue) {

        if(ledValue){

            this._objVisir._$elem.find("img").attr("src", "static/visir/instruments/breadboard/images/butterfly-led-on.png");

            // Make sure that the breadboard recognizes this change by updating the breadboard state
            if (this._breadboard !== null) {
                this._breadboard.Update();
            }
        }
        else {
            this._objVisir._$elem.find("img").attr("src", "static/visir/instruments/breadboard/images/butterfly-led-off.png");

            // Make sure that the breadboard recognizes this change by updating the breadboard state
            if (this._breadboard !== null) {
                this._breadboard.Update();
            }

        }

        this._value = ledValue;
        
    };

    Breadboard.LEDs.prototype.setPinLocation = function(leftPosition, topPosition) {
        this._vertical = this._objVisir.translation.rot == "0";
        // LED is vertical
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
        
        if(this._topPosition < 261){
            this._onTopHalf = true;
        }
        else{
            this._onTopHalf = false;
        }
    }

    // The getter function that obtains the x value coordinates of where the wire should be
    Breadboard.LEDs.prototype.GetWireX = function () {
        this.setPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        if(this._vertical){
            return this._leftPosition;
        }
        // LED is horizontal
        else {
            return this._leftPosition - 2*VISIR_SQUARE_SIZE;
        }
    }

    // The getter function that obtains the y value coordinates of where the wire should be
    Breadboard.LEDs.prototype.GetWireYBase = function () {
        this.setPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        if(this._vertical){
            if (this._onTopHalf) 
                return this._topPosition + 2*VISIR_SQUARE_SIZE;
            else
                return this._topPosition - 2*VISIR_SQUARE_SIZE;
            }
        // LED is horizontal
        else {
            return this._topPosition;
        }
       
    }

    Breadboard.LEDs.prototype.checkIfGround = function (point) {
        var isGround = null;
        var requiresPoint = null;
        var yPos = this.GetWireYBase();
        var xPos = this.GetWireX();
        if(this._vertical){
            if(this._onTopHalf){
                yPos = yPos - 4*VISIR_SQUARE_SIZE;
            }
            else{
                yPos = yPos + 4*VISIR_SQUARE_SIZE;
            }

            if (xPos >= 177 && xPos < 554) {
                if (yPos == 406 || yPos == 159) {
                    isGround = false;
                    requiresPoint = false;
                }
            }
        }
        else{
            xPos = xPos + 4*VISIR_SQUARE_SIZE;
            if(this._onTopHalf){
                if(point.x == xPos && point.y > 159 && point.y < 261){
                    isGround = false;
                    requiresPoint = true;
                }
            }
            else{
                if(point.x == xPos && point.y > 261 && point.y << 406){
                    isGround = false;
                    requiresPoint = true;
                }
            }
        }
        return [isGround, requiresPoint];
    }

    // The switch objects in the breadboard
    Breadboard.Switch = function (identifier, imageBase, leftPosition, topPosition, objVisir) {
        var self = this;
        // Obtain the two images for the switches from the static folder
        var image1 = imageBase + "switch-left-small.jpg";
        var image2 = imageBase + "switch-right-small.jpg";

        if(objVisir){
            this._objVisir = objVisir;
        }

        this._leftPosition = leftPosition;
        this._rightPosition = topPosition;
        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1, image2);

        // Link appropriate css that makes the mouse become a pointer
        if(objVisir){
            this._objVisir._$elem.css({'cursor': 'pointer'});
            this._objVisir._$elem.find("img").attr("src", "static/visir/instruments/breadboard/images/butterfly-switch-right-small.jpg");

            this._value = false;
            this._objVisir._$elem.find('img').click(function () {
                self._Change();
                var newStringToSend = self._breadboard.Update();
                if(newStringToSend.includes("Error")){
                    if(self._breadboard.GetErrorChecks()){
                        document.getElementById("protocol").innerHTML = newStringToSend;
                    }
                }
                else{
                    if(self._breadboard.GetErrorChecks()){
                        document.getElementById("protocol").innerHTML = "Ready";
                    }
                    parent.postMessage({
                        messageType: "web2sim",
                        version: "1.0",
                        value: newStringToSend
                    }, '*');
            
                }
            });
        }
        
    };

    Breadboard.Switch.prototype = Object.create(Breadboard.Component.prototype);


    // change the output state of the switch, triggered upon each user click
    Breadboard.Switch.prototype._Change = function () {
        this._value = !this._value;
        this._valueChanged = true;

        if(this._value){
            this._objVisir._$elem.find("img").attr("src", "static/visir/instruments/breadboard/images/butterfly-switch-left-small.jpg");
        }
        else{
            this._objVisir._$elem.find("img").attr("src", "static/visir/instruments/breadboard/images/butterfly-switch-right-small.jpg");
        }

        // Make sure that the breadboard recognizes this change by updating the breadboard state
        if (this._breadboard !== null) {
            this._breadboard.Update();
        }
    };

    // The getter function that returns the current state value of the switch
    Breadboard.Switch.prototype.GetValue = function() {
        return this._value;
    }

    Breadboard.Switch.prototype.checkIfPowered = function(point){
        var wireYBase = this.GetWireYBase();
        if(point.x == this.GetLeftX() && point.y >= wireYBase && point.y <= (wireYBase + 4*VISIR_SQUARE_SIZE)){
            return true;
        }
        else if(point.x == this.GetRightX() && point.y >= wireYBase && point.y <= (wireYBase + 4*VISIR_SQUARE_SIZE)){
            return false;
        }
        else{
            return null;
        }
    }

    Breadboard.Switch.prototype.SetSwitchLocation = function(xPos, yPos) {
        this._leftPosition = xPos;
        this._topPosition = yPos;
    }

    Breadboard.Switch.prototype.GetLeftX = function(){
        this.SetSwitchLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._leftPosition - VISIR_SQUARE_SIZE;
    }

    Breadboard.Switch.prototype.GetRightX = function() {
        this.SetSwitchLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._leftPosition + VISIR_SQUARE_SIZE;
    }
    // The getter function that obtains the x value coordinates of where the wire should be
    Breadboard.Switch.prototype.GetWireX = function () {
        this.SetSwitchLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._leftPosition;
        // return this._leftPosition + 20;
    }

    // The getter function that obtains the y value coordinates of where the wire should be
    Breadboard.Switch.prototype.GetWireYBase = function () {
        this.SetSwitchLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        if (this._topPosition > 300) 
            return 302;
        else
            return 211;
    }

    //************************newly added */
    // The or gate functionality of the breadboard
    Breadboard.XorGate = function(identifier, imageBase, leftPosition, topPosition, objVisir){
        var self = this;

        // Obtain the or gate image from the static folder to be placed on the breadbaord
        var image1 = imageBase + "xor_gate.png";
        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1);

        this._leftPosition = leftPosition - 20;
        this._topPosition = topPosition - 15;

        this._objVisir = objVisir;

        // Array that stores each of the 7 pin locations of the logic gate
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
    
        // Array value that stores the states of each pin of the or gate
        this._array_value = [
            false,
            false,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false
        ];

        this._protocol = [
            null, null,
            null, null,
            null, null,
            null, null,
            null, null,
            null, null
        ];
    }

    Breadboard.XorGate.prototype = Object.create(Breadboard.Component.prototype);

    Breadboard.XorGate.prototype.SetPinLocation = function(leftPosition, topPosition) {
        leftPosition = leftPosition - 20;
        topPosition = topPosition - 15;
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
    }

    // the getter function that obtains the pin location for each pin
    Breadboard.XorGate.prototype.GetPinLocation = function () {
        this.SetPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._pin_location;
    }

    // [true, 3, 1]
    // this means: true, there is an input
    //             the gate number
    //             the input number for that particular gate
    Breadboard.XorGate.prototype.CheckIfInput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            for(var i = 1; i < pinLocation.length; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 3 && i != 6){
                        // return [true, i < 3 ? 3 : 4, i < 3 ? i - 3 : i];
                        return [true, i < 3 ? 3 : 4, i < 3 ? i : i - 3];
                    }
                }
            }
            return [false, -1, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            for(var i = 0; i < pinLocation.length - 1; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 2 && i != 5){
                        return [true, i < 2 ? 1 : 2, i < 2 ? i + 1 : i - 2];
                    }
                }
            }
            return [false, -1, -1];

        }
        return [false, -1, -1];
    }

    Breadboard.XorGate.prototype.CheckIfOutput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[3]){
                return [true, 3];
            }
            else if(pin.x === pinLocation[6]){
                return [true, 4]
            }
            return [false, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            if(pin.x === pinLocation[2]){
                return [true, 1];
            }
            else if(pin.x === pinLocation[5]){
                return [true, 2];
            }
            return [false, -1];

        }
        return [false, -1];
    }

    Breadboard.XorGate.prototype.CheckIfPower = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[0]){
                // This is a Vcc pin
                return true;
            }
        }
        else if(pin.y >= this._topPosition && pin.y < 406){
            if(pin.x === pinLocation[6]){
                // This is a GND pin
                return false;
            }

        }
    }
    //***************end of newly added */

    
    // The or gate functionality of the breadboard
    Breadboard.OrGate = function(identifier, imageBase, leftPosition, topPosition, objVisir){
        var self = this;

        // Obtain the or gate image from the static folder to be placed on the breadbaord
        var image1 = imageBase + "or_gate.png";
        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1);

        this._leftPosition = leftPosition - 20;
        this._topPosition = topPosition - 15;

        this._objVisir = objVisir;

        // Array that stores each of the 7 pin locations of the logic gate
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
    
        // Array value that stores the states of each pin of the or gate
        this._array_value = [
            false,
            false,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false
        ];

        this._protocol = [
            null, null,
            null, null,
            null, null,
            null, null,
            null, null,
            null, null
        ];
    }

    Breadboard.OrGate.prototype = Object.create(Breadboard.Component.prototype);

    Breadboard.OrGate.prototype.SetPinLocation = function(leftPosition, topPosition) {
        leftPosition = leftPosition - 20;
        topPosition = topPosition - 15;
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
    }

    // the getter function that obtains the pin location for each pin
    Breadboard.OrGate.prototype.GetPinLocation = function () {
        this.SetPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._pin_location;
    }

    // [true, 3, 1]
    // this means: true, there is an input
    //             the gate number
    //             the input number for that particular gate
    Breadboard.OrGate.prototype.CheckIfInput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            for(var i = 1; i < pinLocation.length; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 3 && i != 6){
                        // return [true, i < 3 ? 3 : 4, i < 3 ? i - 3 : i];
                        return [true, i < 3 ? 3 : 4, i < 3 ? i : i - 3];
                    }
                }
            }
            return [false, -1, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            for(var i = 0; i < pinLocation.length - 1; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 2 && i != 5){
                        return [true, i < 2 ? 1 : 2, i < 2 ? i + 1 : i - 2];
                    }
                }
            }
            return [false, -1, -1];

        }
        return [false, -1, -1];
    }

    Breadboard.OrGate.prototype.CheckIfOutput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[3]){
                return [true, 3];
            }
            else if(pin.x === pinLocation[6]){
                return [true, 4]
            }
            return [false, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            if(pin.x === pinLocation[2]){
                return [true, 1];
            }
            else if(pin.x === pinLocation[5]){
                return [true, 2];
            }
            return [false, -1];

        }
        return [false, -1];
    }

    Breadboard.OrGate.prototype.CheckIfPower = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[0]){
                // This is a Vcc pin
                return true;
            }
        }
        else if(pin.y >= this._topPosition && pin.y < 406){
            if(pin.x === pinLocation[6]){
                // This is a GND pin
                return false;
            }

        }
    }
    // ***********************************************************************************
    // The and gate functionality of the breadboard
    Breadboard.AndGate = function(identifier, imageBase, leftPosition, topPosition, objVisir) {
        var self = this;

        // Obtain the or gate image from the static folder to be placed on the breadbaord
        var image1 = imageBase + "and_gate.png";
        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1);

        this._leftPosition = leftPosition - 20;
        this._topPosition = topPosition - 15;

        this._objVisir = objVisir;
        
        // Array that stores each of the 7 pin locations of the logic gate
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];

        // Array value that stores the states of each pin of the logic gate
        this._array_value = [
            false,
            false,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false
        ];

        this._protocol = [
            null, null,
            null, null,
            null, null,
            null, null,
            null, null,
            null, null
        ];
    }

    Breadboard.AndGate.prototype = Object.create(Breadboard.Component.prototype);

    Breadboard.AndGate.prototype.SetPinLocation = function(leftPosition, topPosition) {
        leftPosition = leftPosition - 20;
        topPosition = topPosition - 15;
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
    }

    // the getter function that obtains the pin location for each pin
    Breadboard.AndGate.prototype.GetPinLocation = function () {
        this.SetPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._pin_location;
    }

    Breadboard.AndGate.prototype.CheckIfInput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            for(var i = 1; i < pinLocation.length; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 3 && i != 6){
                        return [true, i < 3 ? 3 : 4, i < 3 ? i : i - 3];
                    }
                }
            }
            return [false, -1, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            for(var i = 0; i < pinLocation.length - 1; i++){
                if(pin.x === pinLocation[i]){
                    if(i != 2 && i != 5){
                        return [true, i < 2 ? 1 : 2, i < 2 ? i + 1 : i - 2];
                    }
                }
            }
            return [false, -1, -1];

        }
        return [false, -1, -1];
    }

    Breadboard.AndGate.prototype.CheckIfOutput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[3]){
                return [true, 3];
            }
            else if(pin.x === pinLocation[6]){
                return [true, 4]
            }
            return [false, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            if(pin.x === pinLocation[2]){
                return [true, 1];
            }
            else if(pin.x === pinLocation[5]){
                return [true, 2];
            }
            return [false, -1];

        }
        return [false, -1];
    }

    Breadboard.AndGate.prototype.CheckIfPower = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[0]){
                // This is a Vcc pin
                return true;
            }
        }
        else if(pin.y >= this._topPosition && pin.y < 406){
            if(pin.x === pinLocation[6]){
                // This is a GND pin
                return false;
            }

        }
    }
    // ***************************************************************************************************************************
    // The and gate functionality of the breadboard
    Breadboard.NotGate = function(identifier, imageBase, leftPosition, topPosition, objVisir) {
        var self = this;
        // Obtain the or gate image from the static folder to be placed on the breadbaord
        var image1 = imageBase + "not_gate.png";

        this._leftPosition = leftPosition - 20;
        this._topPosition = topPosition - 15;

        this._objVisir = objVisir;

        // Breadboard.Component.call(this, identifier, leftPosition, topPosition, image1);
        
        // Array that stores each of the 7 pin locations of the logic gate
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];

        // Array value that stores the states of each pin of the logic gate
        this._array_value = [
            false,
            true,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false
        ];

        this._protocol = [
            null, null,
            null, null,
            null, null,
            null, null,
            null, null,
            null, null
        ];
    }

    Breadboard.NotGate.prototype = Object.create(Breadboard.Component.prototype);

    Breadboard.NotGate.prototype.SetPinLocation = function(leftPosition, topPosition) {
        leftPosition = leftPosition - 20;
        topPosition = topPosition - 15;
        this._pin_location = [
            leftPosition + 7,
            leftPosition + 20,
            leftPosition + 33,
            leftPosition + 46,
            leftPosition + 59,
            leftPosition + 72,
            leftPosition + 85
        ];
        this._leftPosition = leftPosition;
        this._topPosition = topPosition;
    }
    
    // the getter function that obtains the pin location for each pin
    Breadboard.NotGate.prototype.GetPinLocation = function () {
        // console.log(this.GetPos().x);
        this.SetPinLocation(this._objVisir.GetPos().x, this._objVisir.GetPos().y);
        return this._pin_location;
    }

    Breadboard.NotGate.prototype.CheckIfInput = function(pin){
        // top half
        var pinLocation = this.GetPinLocation();
        if(pin.y < this._topPosition && pin.y > 159){
            // 9, 11, 13
            for(var i = 1; i < pinLocation.length; i++){
                if(pin.x === pinLocation[i] && (i % 2 != 0)){
                    return [true, Math.floor((i+7)/2)-1];
                }
            }
            return [false, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            // 0, 2, 4
            for(var i = 0; i < pinLocation.length - 1; i++){
                if(pin.x === pinLocation[i] && (i % 2 == 0)){
                    return [true, i/2];
                }
            }
            return [false, -1];
        }
        return [false, -1];
    }

    Breadboard.NotGate.prototype.CheckIfOutput = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            // 8, 10, 12
            for(var i = 1; i < pinLocation.length; i++){
                if(pin.x === pinLocation[i] && (i % 2 == 0)){
                    return [true, Math.floor((i+7)/2)];
                }
            }
            return [false, -1];
        }
        // bottom half
        else if(pin.y >= this._topPosition && pin.y < 406) {
            for(var i = 0; i < pinLocation.length - 1; i++){
                // 1, 3, 5
                if(pin.x === pinLocation[i] && (i % 2 != 0)){
                    return [true, Math.floor(i/2)+1];
                }
            }
            return [false, -1];
        }
        return [false, -1];
    }

    Breadboard.NotGate.prototype.CheckIfPower = function(pin){
        var pinLocation = this.GetPinLocation();
        // top half
        if(pin.y < this._topPosition && pin.y > 159){
            if(pin.x === pinLocation[0]){
                // This is a Vcc pin
                return true;
            }
        }
        else if(pin.y >= this._topPosition && pin.y < 406){
            if(pin.x === pinLocation[6]){
                // This is a GND pin
                return false;
            }

        }
        return null;
    }
    // ***************************************************************************************************************************

    // All potential error messages that a user may experience
    var ERROR_MESSAGES = {
        "null": "Error: Every wire must be connected to a valid component or valid GPIO",
        "inputs": "Error: Both ends of a wire are connected to an input",
        "outputs": "Error: Both ends of a wire are connected to an output",
        "leds": "Error: A virtual LED is not properly wired",
        "led-position": "Error: Invalid LED position. Move to different location on breadboard",
        "switches": "Error: A virtual switch is not properly wired",
        "component-power": "Error: A component is not properly powered",
        "component-placement": "Error: Illegal placement of a component",
        "ready": "Ready"
    };

    // These are the hardcoded wires and values onto the breadbaord
    function getOriginalWires(numberOfSwitches) {
        var originalWires = ("<circuit>" +
        "   <circuitlist>" +
        "      <component>W 16711680 156 143 190 142 221 143</component>" +
        "      <component>W 0 156 156 188 155 221 156</component>" +
        "      <component>W 16711680 637 416 613 414 585 416</component>" +
        "      <component>W 0 585 403 611 402 637 403</component>" +
        "      <component>W 0 156 156 275 -43.171875 338 39</component>");

        var switchWires = [ 
            ("     <component>W 16711680 234 351 235 387 234 416</component>" +
            "      <component>W 0 208 351 216 381 221 403</component>"),

            ("     <component>W 16711680 273 351 274 386 273 416</component>" +
            "      <component>W 0 247 351 248 378 247 403</component>"),

            ("     <component>W 16711680 312 351 312 386 312 416</component>" +
            "      <component>W 0 286 351 292 378 299 403</component>"),

            ("     <component>W 16711680 351 351 351 383 351 416</component>" +
            "      <component>W 0 325 351 325 377 325 403</component>"),

            ("     <component>W 16711680 390 351 392 389 390 416</component>" +
            "      <component>W 0 364 351 370 377 377 403</component>"),

            ("     <component>W 16711680 429 351 430 385 429 416</component>" +
            "      <component>W 0 403 351 404 376 403 403</component>"),

            ("     <component>W 16711680 468 351 469 389 468 416</component>" +
            "      <component>W 0 442 351 449 378 455 403</component>"),

            ("     <component>W 16711680 507 351 508 385 507 416</component>" +
            "      <component>W 0 481 351 481 376 481 403</component>"),

            ("     <component>W 16711680 546 351 548 386 546 416</component>" +
            "      <component>W 0 520 351 530 381 533 403</component>"),

            ("     <component>W 16711680 585 351 580 379 572 416</component>" +
            "      <component>W 0 559 403 560 386 559 351</component>"),

            ("     <component>W 16711680 247 208 246 176 247 143</component>" +
            "      <component>W 0 221 208 229 178 234 156</component>"),

            ("     <component>W 16711680 273 143 280 176 286 208</component>" +
            "      <component>W 0 260 208 262 181 260 156</component>"),

            ("     <component>W 16711680 325 143 326 179 325 208</component>" +
            "      <component>W 0 299 208 300 179 299 156</component>"),

            ("     <component>W 16711680 351 143 358 175 364 208</component>" +
            "      <component>W 0 338 208 340 183 338 156</component>"),

            ("     <component>W 16711680 403 143 404 172 403 208</component>" +
            "      <component>W 0 377 208 378 179 377 156</component>"),

            ("     <component>W 16711680 429 143 438 179 442 208</component>" +
            "      <component>W 0 416 208 416 179 416 156</component>"),

            ("     <component>W 16711680 481 208 481 172 481 143</component>" +
            "      <component>W 0 455 208 455 177 455 156</component>"),

            ("     <component>W 16711680 520 208 526 172 507 143</component>" +
            "      <component>W 0 494 208 495 182 494 156</component>") 
        ];

        // Make sure each switch has those hardcoded values, so that no switch is left unassigned
        for (var i = 0; i < numberOfSwitches; i++) {
            if (i < switchWires.length) {
                originalWires = originalWires + switchWires[i];
            }
        }

        originalWires = originalWires + (
        "   </circuitlist>" +
        "</circuit>");

        return originalWires;
    }

    // Finally, we are done with the breadbaord. We can return it to the html
    return Breadboard;
}();
