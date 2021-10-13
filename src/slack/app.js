"use strict";

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("querystring");
const debug = require("debug")("slash-command-template:index");
const signature = require("./verifySignature");
const apiUrl = "https://slack.com/api";

const app = express();

/*
 * Parse application/x-www-form-urlencoded && application/json
 * Use body-parser's `verify` callback to export a parsed raw body
 * that you need to use to verify the signature
 */

const rawBodyBuffer = (req, res, buf, encoding) => {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || "utf8");
    }
};

app.use(
    bodyParser.urlencoded({
        verify: rawBodyBuffer,
        extended: true
    })
);
app.use(
    bodyParser.json({
        verify: rawBodyBuffer
    })
);

app.get("/", (req, res) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.send("The Infra as Design app is running");
});

/*
 * Endpoint to receive /iad slash command from Slack.
 * Checks verification token and opens a dialog to capture more info.
 */
app.post('/iad', (req, res) => {
  // extract the slash command text, and trigger ID from payload
  const { text, trigger_id } = req.body;

  // Verify the signing secret
  if (signature.isVerified(req)) {
    // create the dialog payload - includes the dialog structure, Slack API token,
    // and trigger ID
    const view = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id,
      view: JSON.stringify({
        title: {
            type: "plain_text",
            text: "Infrastructure as Design",
            emoji: true
        },
        submit: {
            type: "plain_text",
            text: "Submit",
            emoji: true
        },
        type: "modal",
        close: {
            type: "plain_text",
            text: "Cancel",
            emoji: true
        },
        blocks: [
            {
                type: "input",
                element: {
                    type: "plain_text_input",
                    action_id: "aws_accesskeyid",
                    placeholder: {
                        type: "plain_text",
                        text: "Please enter AWS AccessKeyId"
                    }
                },
                label: {
                    type: "plain_text",
                    text: "AWS SecretKey"
                }
            },
            {
                            type: "input",
                            element: {
                                type: "plain_text_input",
                                action_id: "aws_secretkey",
                                placeholder: {
                                    type: "plain_text",
                                    text: "Please enter AWS SecretKey"
                                }
                            },
                            label: {
                                type: "plain_text",
                                text: "AWS SecretKey"
                            }
                        },
            {
                type: "input",
                element: {
                    type: "radio_buttons",
                    options: [
                        {
                            text: {
                                type: "plain_text",
                                text: "US West (Northern California) Region",
                                emoji: true
                            },
                            value: "US West (Northern California) Region"
                        },
                        {
                            text: {
                                type: "plain_text",
                                text: "US East (Ohio) Region",
                                emoji: true
                            },
                            value: "US East (Ohio) Region"
                        },
                        {
                            text: {
                                type: "plain_text",
                                text: "US West (Oregon) Region",
                                emoji: true
                            },
                            value: "US West (Oregon) Region"
                        }
                    ],
                    action_id: "radio_buttons-action"
                },
                label: {
                    type: "plain_text",
                    text: "AWS Region",
                    emoji: true
                }
            },
            {
                type: "input",
                element: {
                    type: "plain_text_input",
                    action_id: "lucid_auth_code",
                    placeholder: {
                        type: "plain_text",
                        text: "Please enter your AUTHORIZATION CODE of Lucid"
                    }
                },
                label: {
                    type: "plain_text",
                    text: "AUTHORIZATION CODE of Lucid"
                }
            }

        ]
      })
    };
    axios.post(`${apiUrl}/views.open`, qs.stringify(view))
      .then((result) => {
        debug('views.open: %o', result.data);
        res.send('');
      }).catch((err) => {
        debug('views.open call failed: %o', err);
        res.sendStatus(500);
      });
   } else {
    debug('Verification token mismatch');
    res.sendStatus(404);
  }
});

/*
 * Endpoint to receive /intearactive slash command from Slack.
 * Checks verification token and prints a message in a slack channel.
 */
app.post("/interactive", async (req, res) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    // Verify the signing secret
    if (signature.isVerified(req, process.env.SLACK_SIGNING_SECRET)) {
        // Posts a message on a separate slack channel
        console.log("Printing message in a separate slack channel");
        const stateArr = ["success", "failure"];
        for (const state of stateArr) {
            //await projectMakerService.getResponse(state).then(async function(response) {
                await postMessage(response);
            //});
        }
        res.send("");
    } else {
        debug("Verification token mismatch");
        res.sendStatus(404);
    }
});

/*
 * Posts a message in separate slack channel.
 */
async function postMessage(response) {
    let errorMessage = "";
    let blocks = [];
    if (!response.gitRepoCreated || !response.jenkinsPipelineCreated) {
        errorMessage = response.error + " : " + response.message;
        blocks = [{
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*ERROR* \nFailed to create infrastructure!\n${errorMessage}`
            }
        }];
    } else {
        blocks = [{
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*SUCCESS* \nA new infrastrucure has been created successfully!\n\n"
                }
            },

        ];
    }

    const postData = {
        token: process.env.SLACK_ACCESS_TOKEN,
        channel: "#dj",
        blocks: JSON.stringify(blocks)
    };
    try {
        axios.post(`${apiUrl}/chat.postMessage`, qs.stringify(postData));
    } catch (e) {
        console.log(`Error posting message: ${e}`);
    }
}

const server = app.listen(process.env.PORT || 5000, () => {
    console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
});

module.exports = server;
