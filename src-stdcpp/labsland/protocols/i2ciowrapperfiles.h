/*
 * Copyright (C) 2023 onwards LabsLand, Inc.
 * All rights reserved.
 *
 * This software is licensed as described in the file LICENSE, which
 * you should have received as part of this distribution.
 */
#ifndef I2C_LABSLAND_PROTOCOLS_IO_WRAPPER_FILES_H
#define I2C_LABSLAND_PROTOCOLS_IO_WRAPPER_FILES_H

#include <string>
#include <thread>
#include <atomic>
#include "labsland/protocols.h"

namespace LabsLand::Protocols {

    /*
     * This class represents a single I2C channel (e.g., i2c0 or i2c1), relying on files and
     * threads. Internally, once initialized, it will start running checking a file in this
     * for inputs, and it will support calling the outputs within those callback calls.
     */
    class I2C_IO_WrapperFiles : public I2C_IO_Wrapper {
        private:
            std::thread * monitoringThread = 0;
            std::atomic<bool> continueRunning{true};
            std::string outputFileName;
            std::string inputFileName;
            
        public:
            I2C_IO_WrapperFiles();
            ~I2C_IO_WrapperFiles();

            virtual void initialize(const std::string & outputFile, const std::string & inputFile, const std::string & signalFile, const i2cSlaveCallback * callback);

            virtual unsigned char readByte() override;
            virtual void writeByte(unsigned char byte) override;

            bool shouldContinueRunning();
    };
}

#endif
