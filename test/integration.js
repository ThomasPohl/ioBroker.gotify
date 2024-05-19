const path = require("path");
const { tests } = require("@iobroker/testing");
//require('debug').enable('*');
// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, ".."), {
    //            ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, termination during startup is not allowed.
    allowedExitCodes: [11],
    waitBeforeStartupSuccess: 5000,
    // To test against a different version of JS-Controller, you can change the version or dist-tag here.
    // Make sure to remove this setting when you're done testing.
    controllerVersion: "latest", // or a specific version like "4.0.1"

    // Define your own tests inside defineAdditionalTests
    defineAdditionalTests({ suite }) {
        // All tests (it, describe) must be grouped in one or more suites. Each suite sets up a fresh environment for the adapter tests.
        // At the beginning of each suite, the databases will be reset and the adapter will be started.
        // The adapter will run until the end of each suite.

        // Since the tests are heavily instrumented, each suite gives access to a so called "harness" to control the tests.
        suite.only("Test sendTo()", (getHarness) => {
            // For convenience, get the current suite's harness before all tests
            let harness;
            before(() => {
                harness = getHarness();
            });

            it("unconfigured should fail", () => {
                return new Promise(async (resolve, reject) => {
                    console.log("Starting adapter...");
                    // Start the adapter and wait until it has started
                    await harness
                        .startAdapterAndWait()
                        .then(() => {
                            console.log("Adapter started");
                            //Get state info.connection
                            harness.states
                                .getState("gotify.0.info.connection")
                                .then((state) => {
                                    console.log("State info.connection: " + JSON.stringify(state));
                                    if (state && state.val === true) {
                                        console.log(
                                            "Connection established - should not happen - adapter is not configured",
                                        );
                                        reject();
                                    } else {
                                        resolve();
                                    }
                                })
                                .catch((error) => {
                                    console.log("Adapter not started: " + error);
                                    reject();
                                });
                        })
                        .catch((error) => {
                            console.log("Adapter not started: " + error);
                            reject();
                        });
                });
            });
        });

        // While developing the tests, you can run only a single suite using `suite.only`...
        //suite.only("Only this will run", (getHarness) => {
        // ...
        //});
        // ...or prevent a suite from running using `suite.skip`:
        //suite.skip("This will never run", (getHarness) => {
        // ...
        //});
    },
});
