/*
 * Copyright (C) 2023 onwards LabsLand, Inc.
 * All rights reserved.
 *
 * This software is licensed as described in the file LICENSE, which
 * you should have received as part of this distribution.
 */
#ifndef LL_TARGET_DEVICE
#define LL_TARGET_DEVICE

namespace LabsLand::Utils {


    enum NamedGpio {
        // custom serial
        customSerialLatch,
        customSerialDataOut,
        customSerialPulse,
        // other custom protocols
    };

    /**
     *
     * These simulations work interacting with a number of devices (e.g., different types of FPGAs, microprocessors and such).
     *
     * These devices have different GPIOs and they are assigned to different numbers.
     *
     * To make the development easier, we have this class. We will later have a class implementing each real device, without
     * having to change the code of the simulations.
     *
     * The design is the following:
     *
     * a) Every device has a set of GPIOs. By default, some are input, some are output. 
     * b) Some simulations might change this (e.g., turn an input into an output) in very specific cases.
     * c) Simulations will allocate a number of input GPIOs for themselves, and a number of output GPIOs for themselves.
     * d) This class will have to take care of everything else.
     *
     * For example:
     *
     * a) A device has 14 outputs (e.g., GPIO0-GPIO5 and GPIO10-GPIO17) and 4 inputs (e.g., GPIO6-GPIO9). By default this is it.
     *
     * b) Additionally, a device has a set of GPIOs that are tagged as "for-simulation", in a specific order. 
     *    For example, maybe there is a relay that depending on the configuration, a pin of the target device will be connected to 
     *    a motor or to GPIO15. If the designer of the board wants to guarantee that the GPIO15 is not used in the board, what he would
     *    typically do is to set that the simulation gpios are GPIO17-GPIO16, GPIO14-GPIO10 in this order.
     *
     * c) A particular simulation allocates 5 of the outputs and 2 of the inputs.
     *
     *    The simulation therefore will get GPIO17, GPIO16, GPIO14, GPIO13, GPIO12 for output, and GPIO8-GPIO9 for inputs.
     *
     *    This means that if the user requests "turn gpio 10 on" (e.g., with a switch), it will work, because it is not allocated by the
     *    simulation, so those GPIOs will still work. But if the user requests "turn gpio 12 on", it will not work, because the GPIO12
     *    is already assigned to the simulation, and instead will return an error.
     *
     * d) Additionally, a simulation might allocate named inputs and outputs. For example, certain well known names (and only those)
     *    can be allocated. This only happens with specific protocols (e.g., custom serial, i2c, spi, etc.), where the board might want
     *    to allow specific names for that.
     *
     * e) Finally, it is sometimes possible to request a superior number of inputs or outputs that there actually is, and the TargetDevice,
     *    if possible, will reassign certain inputs as outputs and viceversa. This will only happen in some boards and in specific pins.
     *
     *
     * Important: simulations will be able to know in advance if a target device works or not.
     */
    class TargetDevice {
        public:
            /*
             * Does it support this number of inputs and outputs?
             */
            virtual bool checkSimulationSupport(int outputGpios, int inputGpios) = 0;

            /*
             * Allocate a set of outputs and inputs, in whichever order the device defines.
             *
             * It returns true/false if possible.
             */
            virtual bool initializeSimulation(int outputGpios, int inputGpios) = 0;

            /*
             * Reset to the default state of the target device (e.g., all GPIOs available for regular use)
             */
            virtual void resetAfterSimulation() = 0;

            /*
             * If custom serial is going to be used, initialize it. It will return false if not possible.
             */
            virtual bool initializeCustomSerial() = 0;

            // Add other protocols in the future

            /*
             * Regular operations with GPIO (set/get) based on the position.
             * Important: setGpio(1) does not set GPIO1 to 1: it sets to 1 whichever is the second
             * output GPIO for simulations reserved. In the example above, where the simulation 
             * reserved GPIO17, GPIO16, GPIO14, GPIO13, GPIO12, setGpio(1) is GPIO16=1
             */
            virtual void setGpio(int outputPosition, bool value = true) = 0;
            virtual void resetGpio(int outputPosition) = 0;
            virtual bool getGpio(int inputPosition) = 0;

            /**
             * Same, but using custom names
             */
            virtual void setGpio(NamedGpio outputPosition, bool value = true) = 0;
            virtual void resetGpio(NamedGpio outputPosition) = 0;
            virtual bool getGpio(NamedGpio inputPosition) = 0;
    };
}

#endif