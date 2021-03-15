if (!window.Socket) window.Socket = {};
window.Socket.Server = {
    _connection: null,
    _webserver: null,
    _webserver_id: null,
    _motd: "A third-party OpenSend Messaging Server.",
    _ready_to_authenticate: false,
    _authentication_string: null,
    _authenticated: false,
    _protocol: null,
    _information : null,
    _state: "INACTIVE",
    _handlers: {
        message: (message) => {
            let json;
            try {
                json = JSON.parse(message);
            } catch (err) {
                console.warn(this._webserver + " returned unknown websocket data: " + message + "\n\n" + err);
            }

            if (!json.event || !json.data || !json.timestamp) return this.send(this._ERR.INVALID_DATA);

            switch (json.event) {
                case "server:connected":
                    if (this._state !== "CONNECTING") return this.send(this._ERR.VIOLATION);
                    this._state = "INFORMATION";
                    return this.send(this._.connected());
                case "server:information":
                    if (this._state !== "INFORMATION") return this.send(this._ERR.VIOLATION);
                    if (json.data.motd) this._motd = json.data.motd;
                    this._state = "NEGOTIATE";
                    return this.send(this._.information());
                case "server:negotiate":
                    if (this._state !== "NEGOTIATE") return this.send(this._ERR.VIOLATION);
                    this._state = "SET_PROTOCOL";
                    return this.send(this._.negotiate());
                case "server:set_protocol":
                    if (this._state !== "SET_PROTOCOL") return this.send(this._ERR.VIOLATION);
                    if (!json.data.protocol) return this.send(this._ERR.INVALID_DATA);
                    this._state = "READY_TO_AUTHENTICATE";
                    this._ready_to_authenticate = true;
                    return this.send(this._.acknowledge_protocol());
                case "server:pre_authentication":
                    if (this._state !== "SERVER_PRE_AUTHENTICATION") return this.send(this._ERR.VIOLATION);
                    if (!json.data.id) return this.send(this._ERR.INVALID_DATA);
                    this._state = "SERVER_AUTHENTICATE";
                    this._authentication_string = this._random();
                    return this._.request_authentication(this._authentication_string);
                case "server:authenticate":
                    if (this._state !== "SERVER_PRE_AUTHENTICATION") return this.send(this._ERR.VIOLATION);
                    if (!json.data.id) return this.send(this._ERR.INVALID_DATA);
                    this._state = "SERVER_AUTHENTICATE";
                    this._authentication_string = this._random();
                    return this._.request_authentication(this._authentication_string);
            }
        }
    },
    _hash: (data) => {
        let md = forge.md.sha384.create();
        md.update(data);
        return md.digest().toHex();
    },
    _random: () => {
        return forge.random.getBytesSync(512);
    },
    connect: (server) => {
        this._webserver = "wss://" + server;
        console.info("Connecting to remote server: " + this._webserver);

        this._connection = new WebSocket(this._webserver);
        this._connection.ping();

        this._connection.onmessage = this._handlers.message;
        console.info("Connected. Waiting for server: " + this._webserver);
    },
    send: (data) => {
        try {
            data.event = "client:" + data.event;
            data.timestamp = Date.now();
            data.hash = {
                algorithm: "sha384",
                value: this._hash(JSON.stringify(data))
            };

            this._webserver.send(JSON.stringify(data));
        } catch(err) {
            console.error("Couldn't send websocket data to " + this._webserver + "\n\n" + err);
        }
    },
    _: {
        connected: () => {
            return {
                event: "connected",
                data: {
                    message: "I can hear you!"
                }
            };
        },
        information: () => {
            return {
                event: "information",
                data: {
                    message: "Here's my client information...",
                    application: window.OpenSend.application.name,
                    version: window.OpenSend.application.version
                }
            };
        },
        negotiate: () => {
            return {
                event: "negotiate",
                data: {
                    message: "I can support...",
                    notBefore: window.OpenSend.supported.notBefore,
                    notAfter: window.OpenSend.supported.notAfter
                }
            };
        },
        acknowledge_protocol: (protocol) => {
            return {
                event: "acknowledge_protocol",
                data: {
                    message: "Okay. We're using protocol...",
                    protocol: protocol
                }
            };
        },
        prompt_authentication: () => {
            return {
                event: "prompt_authentication",
                data: {
                    message: "I'm ready to authenticate!"
                }
            };
        },
        request_authentication: (string) => {
            return {
                event: "request_authentication",
                data: {
                    message: "Sign this string for me...",
                    string: string
                }
            };
        },
        authentication_acknowledge: (accept) => {
            return {
                event: "authentication_acknowledge",
                data: {
                    message: "Okay.",
                    accept: accept
                }
            };
        },
        pre_authentication: (uuid) => {
            return {
                event: "pre_authentication",
                data: {
                    message: "I'm user...",
                    uuid: uuid
                }
            };
        },
        authenticate: (string, signed) => {
            return {
                event: "authenticate",
                data: {
                    message: "Here's the string...",
                    string: string,
                    signed: signed
                }
            };
        },
        late_authenticate: () => {
            return {
                event: "late_authenticate",
                data: {
                    message: "Sorry for being late. Can I authenticate now?"
                }
            };
        },
        ACK: () => {
            return {
                event: "acknowledge",
                data: {
                    message: "Okay.",
                    ACK: true
                }
            };
        },
        send_message: (receiver, content, attachments) => {
            return {
                event: "send_message",
                data: {
                    message: "Send this message...",
                    receiver: receiver,
                    attachments: attachments,
                    content: content
                }
            };
        },
        get_messages: () => {
            return {
                event: "get_messages",
                data: {
                    message: "Can you send me my messages?"
                }
            };
        },
        set_status: (status) => {
            return {
                event: "set_status",
                data: {
                    message: "Set my status to...",
                    status: status
                }
            };
        },
        set_settings: (read_receipts) => {
            return {
                event: "set_settings",
                data: {
                    message: "Set my settings to...",
                    read_receipts: read_receipts
                }
            };
        },
        block_user: (uuid) => {
            return {
                event: "block_user",
                data: {
                    message: "I want to block this user...",
                    uuid: uuid
                }
            };
        },
        unblock_user: (uuid) => {
            return {
                event: "unblock_user",
                data: {
                    message: "I want to unblock this user...",
                    uuid: uuid
                }
            };
        },
        ping: () => {
            return {
                event: "ping",
                data: {
                    message: "Are you there?"
                }
            };
        },
        ping_acknowledge: () => {
            return {
                event: "ping_acknowledge",
                data: {
                    message: "I'm here!"
                }
            };
        },
        disconnect: () => {
            return {
                event: "disconnect",
                data: {
                    message: "I need to disconnect."
                }
            };
        },
        disconnect_acknowledge: () => {
            return {
                event: "disconnect_acknowledge",
                data: {
                    message: "Okay, bye!"
                }
            };
        },
        get_info: () => {
            return {
                event: "get_info",
                data: {
                    message: "Can you send me my settings and current status?"
                }
            };
        }
    },
    _ERR: {
        INVALID_DATA: {
            event: "client:error",
            data: {
                error: "INVALID_DATA",
                message: "I have no clue what you just sent me."
            }
        },
        INVALID_CHECKSUM: {
            event: "client:error",
            data: {
                error: "INVALID_CHECKSUM",
                message: "You sent me something, but it seems to be tampered-with/damaged. I'm ignoring it."
            }
        },
        VIOLATION: {
            event: "client:error",
            data: {
                error: "VIOLATION",
                message: "You've done something wrong."
            }
        },
        UNKNOWN: {
            event: "client:error",
            data: {
                error: "UNKNOWN",
                message: "Something has gone wrong."
            }
        }
    }
}
