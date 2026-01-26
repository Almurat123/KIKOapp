https://docs.farcaster.xyz/reference/farcaster/api#farcaster-client-api-reference

https://docs.farcaster.xyz/reference/farcaster/signer-requests#signer-requests

https://docs.farcaster.xyz/reference/farcaster/intent-urls#intent-urls

https://docs.farcaster.xyz/reference/farcaster/direct-casts#direct-casts

https://docs.farcaster.xyz/reference/farcaster/embeds#farcaster-client-embeds-reference

https://ogp.me/

https://github.com/farcasterxyz/protocol/blob/main/docs/SPECIFICATION.md#14-casts


# Message API

The Message API lets you validate and submit signed Farcaster protocol messages to the Hub. Note that the message has to
be sent as the encoded bytestream of the protobuf (`Message.encode(msg).finish()` in typescript), as POST data to the
endpoint.

The encoding of the POST data has to be set to `application/octet-stream`. The endpoint returns the Message object as
JSON if it was successfully submitted or validated

## submitMessage

Submit a signed protobuf-serialized message to the Hub

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitMessage" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"

```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_CAST_ADD",
    "fid": 2,
    "timestamp": 48994466,
    "network": "FARCASTER_NETWORK_MAINNET",
    "castAddBody": {
      "embedsDeprecated": [],
      "mentions": [],
      "parentCastId": {
        "fid": 226,
        "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
      },
      "text": "Cast Text",
      "mentionsPositions": [],
      "embeds": []
    }
  },
  "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x78ff9a...58c"
}
```


## submitBulkMessages

Submit several signed protobuf-serialized messages to the Hub at once. Each one will be submitted to the node sequentially.

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitBulkMessages" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@SubmitBulkMessagesRequest.encoded.protobuf"

```

**Response**

```json
[
  {
    "data": {
      "type": "MESSAGE_TYPE_CAST_ADD",
      "fid": 2,
      "timestamp": 48994466,
      "network": "FARCASTER_NETWORK_MAINNET",
      "castAddBody": {
        "embedsDeprecated": [],
        "mentions": [],
        "parentCastId": {
          "fid": 226,
          "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
        },
        "text": "Cast Text",
        "mentionsPositions": [],
        "embeds": []
      }
    },
    "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
    "hashScheme": "HASH_SCHEME_BLAKE3",
    "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
    "signatureScheme": "SIGNATURE_SCHEME_ED25519",
    "signer": "0x78ff9a...58c"
  },
  { // ....
  }
]
```

### Auth

If the rpc auth has been enabled on the server (using `--rpc-auth username:password`), you will need to also pass in the
username and password while calling `submitMessage` or `submitBulkMessages` using HTTP Basic Auth.

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitMessage" \
     -u "username:password" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"
```

**JS Example**

```Javascript
import axios from "axios";

const url = `http://127.0.0.1:3381/v1/submitMessage`;

const postConfig = {
  headers: { "Content-Type": "application/octet-stream" },
  auth: { username: "username", password: "password" },
};

// Encode the message into a Buffer (of bytes)
const messageBytes = Buffer.from(Message.encode(castAdd).finish());

try {
  const response = await axios.post(url, messageBytes, postConfig);
} catch (e) {
  // handle errors...
}
```

## validateMessage

Validate a signed protobuf-serialized message with the Hub. This can be used to verify that the hub will consider the
message valid. Or to validate message that cannot be submitted (e.g. Frame actions)

::: details
The hub validates the following for all messages:

- The fid is registered
- The signer is active and registered to the fid
- The message hash is correct
- The signature is valid and corresponds to the signer
- Any other message specific validation

For FrameAction messages, note that the hub does not validate the castId is actually an existing cast. Nor
does it validate the frame url matches the embedded url in the cast. Make sure to check for this if it's
important for your application.

:::

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/validateMessage" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"

```

**Response**

```json
{
  "valid": true,
  "message": {
    "data": {
      "type": "MESSAGE_TYPE_FRAME_ACTION",
      "fid": 2,
      "timestamp": 48994466,
      "network": "FARCASTER_NETWORK_MAINNET",
      "frameActionBody": {
        "url": "https://fcpolls.com/polls/1",
        "buttonIndex": 2,
        "inputText": "",
        "castId": {
          "fid": 226,
          "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
        }
      }
    },
    "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
    "hashScheme": "HASH_SCHEME_BLAKE3",
    "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
    "signatureScheme": "SIGNATURE_SCHEME_ED25519",
    "signer": "0x78ff9a...58c"
  }
}
```

## Using with Rust, Go or other programming languages

Messages need to be signed with a Ed25519 account key belonging to the FID. If you are using a different programming
language
than Typescript, you can manually construct the `MessageData` object and serialize it to the `data_bytes` field of the
message. Then, use the `data_bytes` to compute the `hash` and `signature`. Please see
the [`rust-submitmessage` example](https://github.com/farcasterxyz/hub-monorepo/tree/main/packages/hub-web/examples) for
more details

```rust
use ed25519_dalek::{SecretKey, Signer, SigningKey};
use hex::FromHex;
use reqwest::Client;

use message::{CastAddBody, FarcasterNetwork, MessageData};
use protobuf::Message;


#[tokio::main]
async fn main() {
    let fid = 6833; // FID of the user submitting the message
    let network = FarcasterNetwork::FARCASTER_NETWORK_MAINNET;

    // Construct the cast add message
    let mut cast_add = CastAddBody::new();
    cast_add.set_text("Welcome to Rust!".to_string());

    // Construct the cast add message data object
    let mut msg_data = MessageData::new();
    msg_data.set_field_type(message::MessageType::MESSAGE_TYPE_CAST_ADD);
    msg_data.set_fid(fid);
    msg_data.set_timestamp(
        (std::time::SystemTime::now()
            .duration_since(FARCASTER_EPOCH)
            .unwrap()
            .as_secs()) as u32,
    );
    msg_data.set_network(network);
    msg_data.set_cast_add_body(cast_add);

    let msg_data_bytes = msg_data.write_to_bytes().unwrap();

    // Calculate the blake3 hash, trucated to 20 bytes
    let hash = blake3::hash(&msg_data_bytes).as_bytes()[0..20].to_vec();

    // Construct the actual message
    let mut msg = message::Message::new();
    msg.set_hash_scheme(message::HashScheme::HASH_SCHEME_BLAKE3);
    msg.set_hash(hash);

    // Sign the message. You need to use a signing key that corresponds to the FID you are adding.
    // REPLACE THE PRIVATE KEY WITH YOUR OWN
    let private_key = SigningKey::from_bytes(
        &SecretKey::from_hex("0x...").expect("Please provide a valid private key"),
    );
    let signature = private_key.sign(&msg_data_bytes).to_bytes();

    msg.set_signature_scheme(message::SignatureScheme::SIGNATURE_SCHEME_ED25519);
    msg.set_signature(signature.to_vec());
    msg.set_signer(private_key.verifying_key().to_bytes().to_vec());

    // Serialize the message
    msg.set_data_bytes(msg_data_bytes.to_vec());
    let msg_bytes = msg.write_to_bytes().unwrap();

    // Finally, submit the message to the network

    // Create a reqwest Client
    let client = Client::new();

    // Define your endpoint URL
    let url = "http://127.0.0.1:3381/v1/submitMessage";

    // Make the POST request
    let res = client
        .post(url)
        .header("Content-Type", "application/octet-stream")
        .body(msg_bytes)
        .send()
        .await
        .unwrap();

    // Check if it's success
    if res.status().is_success() {
        println!("Successfully sent the message.");
    } else {
        println!("Failed to send the message. HTTP status: {}", res.status());
    }
}

```
# Casts API

## castById

Get a cast by its FID and Hash.

**Query Parameters**
| Parameter | Description                   | Example                                           |
| --------- | ----------------------------- | ------------------------------------------------- |
| fid       | The FID of the cast's creator | `fid=6833`                                        |
| hash      | The cast's hash               | `hash=0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/castById?fid=2&hash=0xd2b1ddc6c88e865a33cb1a565e0058d757042974
```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_CAST_ADD",
    "fid": 2,
    "timestamp": 48994466,
    "network": "FARCASTER_NETWORK_MAINNET",
    "castAddBody": {
      "embedsDeprecated": [],
      "mentions": [],
      "parentCastId": {
        "fid": 226,
        "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
      },
      "text": "Cast Text",
      "mentionsPositions": [],
      "embeds": []
    }
  },
  "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x78ff9a...58c"
}
```

## castsByFid

Fetch all casts for authored by an FID.

**Query Parameters**
| Parameter      | Description                        | Example                     |
| -------------- | ---------------------------------- | --------------------------- |
| fid            | The FID of the cast's creator      | `fid=6833`                  |
| pageSize       | Optional page size (default: 1000) | `pageSize=100`              |
| pageToken      | Optional page token for pagination | `pageToken=DAEDAAAGlQ...`   |
| reverse        | Optional reverse order flag        | `reverse=true`              |
| startTimestamp | Optional start timestamp filter    | `startTimestamp=1640995200` |
| stopTimestamp  | Optional stop timestamp filter     | `stopTimestamp=1640995200`  |

**Example**

```bash
curl http://127.0.0.1:3381/v1/castsByFid?fid=2
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_CAST_ADD",
        "fid": 2,
        "timestamp": 48994466,
        "network": "FARCASTER_NETWORK_MAINNET",
        "castAddBody": {... },
          "text": "Cast Text",
          "mentionsPositions": [],
          "embeds": []
        }
      },
      "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "3msLXzxB4eEYeF0Le...dHrY1vkxcPAA==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x78ff9a768cf1...2eca647b6d62558c"
    }
  ]
  "nextPageToken": ""
}
```

## castsByParent

Fetch all casts by parent cast's FID and Hash OR by the parent's URL

**Query Parameters**
| Parameter | Description                        | Example                                                                  |
| --------- | ---------------------------------- | ------------------------------------------------------------------------ |
| fid       | The FID of the parent cast         | `fid=6833`                                                               |
| hash      | The parent cast's hash             | `hash=0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9`                        |
| url       | The URL of the parent cast         | `url=chain://eip155:1/erc721:0x39d89b649ffa044383333d297e325d42d31329b2` |
| pageSize  | Optional page size (default: 1000) | `pageSize=100`                                                           |
| pageToken | Optional page token for pagination | `pageToken=DAEDAAAGlQ...`                                                |
| reverse   | Optional reverse order flag        | `reverse=true`                                                           |

**Note**
You can use either `?fid=...&hash=...` OR `?url=...` to query this endpoint

**Example**

```bash
curl http://127.0.0.1:3381/v1/castsByParent?fid=226&hash=0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_CAST_ADD",
        "fid": 226,
        "timestamp": 48989255,
        "network": "FARCASTER_NETWORK_MAINNET",
        "castAddBody": {
          "embedsDeprecated": [],
          "mentions": [],
          "parentCastId": {
            "fid": 226,
            "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
          },
          "text": "Cast's Text",
          "mentionsPositions": [],
          "embeds": []
        }
      },
      "hash": "0x0e501b359f88dcbcddac50a8f189260a9d02ad34",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "MjKnOQCTW42K8+A...tRbJfia2JJBg==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x6f1e8758...7f04a3b500ba"
    }
  ],
  "nextPageToken": ""
}
```

## castsByMention

Fetch all casts that mention an FID

**Query Parameters**
| Parameter | Description                         | Example                   |
| --------- | ----------------------------------- | ------------------------- |
| fid       | The FID that is mentioned in a cast | `fid=6833`                |
| pageSize  | Optional page size (default: 1000)  | `pageSize=100`            |
| pageToken | Optional page token for pagination  | `pageToken=DAEDAAAGlQ...` |
| reverse   | Optional reverse order flag         | `reverse=true`            |

**Note**
Use the `mentionsPositions` to extract the offset in the cast text where the FID was mentioned

**Example**

```bash
curl http://127.0.0.1:3381/v1/castsByMention?fid=6833
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_CAST_ADD",
        "fid": 2,
        "timestamp": 62298143,
        "network": "FARCASTER_NETWORK_MAINNET",
        "castAddBody": {
          "embedsDeprecated": [],
          "mentions": [15, 6833],
          "parentCastId": {
            "fid": 2,
            "hash": "0xd5540928cd3daf2758e501a61663427e41dcc09a"
          },
          "text": "cc  and ",
          "mentionsPositions": [3, 8],
          "embeds": []
        }
      },
      "hash": "0xc6d4607835197a8ee225e9218d41e38aafb12076",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "TOaWrSTmz+cyzPMFGvF...OeUznB0Ag==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x78ff9a768c...647b6d62558c"
    }
  ],
  "nextPageToken": ""
}
```
# Reactions API

The Reactions API will accept the following values for the `reaction_type` field.

| String | Description                              |
| ------ | ---------------------------------------- |
| Like   | Like the target cast                     |
| Recast | Share target cast to the user's audience |

## reactionById

Get a reaction by its created FID and target Cast.

**Query Parameters**
| Parameter     | Description                                     | Example                                                  |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- |
| fid           | The FID of the reaction's creator               | `fid=6833`                                               |
| target_fid    | The FID of the cast's creator                   | `target_fid=2`                                           |
| target_hash   | The cast's hash                                 | `target_hash=0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9` |
| reaction_type | The type of reaction, use string representation | `reaction_type=Like` OR `reaction_type=Recast`           |

**Example**

```bash
curl http://127.0.0.1:3381/v1/reactionById?fid=2&reaction_type=Like&target_fid=1795&target_hash=0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0
```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_REACTION_ADD",
    "fid": 2,
    "timestamp": 72752656,
    "network": "FARCASTER_NETWORK_MAINNET",
    "reactionBody": {
      "type": "REACTION_TYPE_LIKE",
      "targetCastId": {
        "fid": 1795,
        "hash": "0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0"
      }
    }
  },
  "hash": "0x9fc9c51f6ea3acb84184efa88ba4f02e7d161766",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "F2OzKsn6Wj...gtyORbyCQ==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x78ff9a7...647b6d62558c"
}
```

## reactionsByFid

Get all reactions by an FID

**Query Parameters**
| Parameter     | Description                                     | Example                                        |
| ------------- | ----------------------------------------------- | ---------------------------------------------- |
| fid           | The FID of the reaction's creator               | `fid=6833`                                     |
| reaction_type | The type of reaction, use string representation | `reaction_type=Like` OR `reaction_type=Recast` |
| pageSize      | Optional page size (default: 1000)              | `pageSize=100`                                 |
| pageToken     | Optional page token for pagination              | `pageToken=DAEDAAAGlQ...`                      |
| reverse       | Optional reverse order flag                     | `reverse=true`                                 |

**Example**

```bash
curl http://127.0.0.1:3381/v1/reactionsByFid?fid=2&reaction_type=Like
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_REACTION_ADD",
        "fid": 2,
        "timestamp": 72752656,
        "network": "FARCASTER_NETWORK_MAINNET",
        "reactionBody": {
          "type": "REACTION_TYPE_LIKE",
          "targetCastId": {
            "fid": 1795,
            "hash": "0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0"
          }
        }
      },
      "hash": "0x9fc9c51f6ea3acb84184efa88ba4f02e7d161766",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "F2OzKsn6WjP8MTw...hqUbrAvp6mggtyORbyCQ==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x78ff9a768...62558c"
    }
  ],
  "nextPageToken": ""
}
```

## reactionsByCast

Get all reactions to a cast

**Query Parameters**
| Parameter     | Description                                     | Example                                                  |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- |
| target_fid    | The FID of the cast's creator                   | `target_fid=6833`                                        |
| target_hash   | The hash of the cast                            | `target_hash=0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0` |
| reaction_type | The type of reaction, use string representation | `reaction_type=Like` OR `reaction_type=Recast`           |
| pageSize      | Optional page size (default: 1000)              | `pageSize=100`                                           |
| pageToken     | Optional page token for pagination              | `pageToken=DAEDAAAGlQ...`                                |
| reverse       | Optional reverse order flag                     | `reverse=true`                                           |

**Example**

```bash
curl http://127.0.0.1:3381/v1/reactionsByCast?target_fid=2&reaction_type=Like&target_hash=0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_REACTION_ADD",
        "fid": 426,
        "timestamp": 72750141,
        "network": "FARCASTER_NETWORK_MAINNET",
        "reactionBody": {
          "type": "REACTION_TYPE_LIKE",
          "targetCastId": {
            "fid": 1795,
            "hash": "0x7363f449bfb0e7f01c5a1cc0054768ed5146abc0"
          }
        }
      },
      "hash": "0x7662fba1be3166fc75acc0914a7b0e53468d5e7a",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "tmAUEYlt/+...R7IO3CA==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x13dd2...204e57bc2a"
    }
  ],
  "nextPageToken": ""
}
```

## reactionsByTarget

Get all reactions to cast's target URL

**Query Parameters**
| Parameter     | Description                                     | Example                                                                  |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| url           | The URL of the parent cast                      | `url=chain://eip155:1/erc721:0x39d89b649ffa044383333d297e325d42d31329b2` |
| reaction_type | The type of reaction, use string representation | `reaction_type=Like` OR `reaction_type=Recast`                           |

**Example**

```bash
curl http://127.0.0.1:3381/v1/reactionsByTarget?url=chain://eip155:1/erc721:0x39d89b649ffa044383333d297e325d42d31329b2
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_REACTION_ADD",
        "fid": 1134,
        "timestamp": 79752856,
        "network": "FARCASTER_NETWORK_MAINNET",
        "reactionBody": {
          "type": "REACTION_TYPE_LIKE",
          "targetUrl": "chain://eip155:1/erc721:0x39d89b649ffa044383333d297e325d42d31329b2"
        }
      },
      "hash": "0x94a0309cf11a07b95ace71c62837a8e61f17adfd",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "+f/+M...0Uqzd0Ag==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0xf6...3769198d4c"
    }
  ],
  "nextPageToken": ""
}
```
# Links API

A Link represents a relationship between two users (e.g. follow)

The Links API will accept the following values for the `link_type` field.

| String | Description                   |
| ------ | ----------------------------- |
| follow | Follow from FID to Target FID |

## linkById

Get a link by its FID and target FID.

**Query Parameters**
| Parameter  | Description                         | Example            |
| ---------- | ----------------------------------- | ------------------ |
| fid        | The FID of the link's originator    | `fid=6833`         |
| target_fid | The FID of the target of the link   | `target_fid=2`     |
| link_type  | The type of link, as a string value | `link_type=follow` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/linkById?fid=6833&target_fid=2&link_type=follow
```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_LINK_ADD",
    "fid": 6833,
    "timestamp": 61144470,
    "network": "FARCASTER_NETWORK_MAINNET",
    "linkBody": {
      "type": "follow",
      "targetFid": 2
    }
  },
  "hash": "0x58c23eaf4f6e597bf3af44303a041afe9732971b",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "sMypYEMqSyY...nfCA==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x0852c07b56...06e999cdd"
}
```

## linksByFid

Get all links from a source FID

**Query Parameters**
| Parameter | Description                         | Example                   |
| --------- | ----------------------------------- | ------------------------- |
| fid       | The FID of the link's creator       | `fid=6833`                |
| link_type | The type of link, as a string value | `link_type=follow`        |
| pageSize  | Optional page size (default: 1000)  | `pageSize=100`            |
| pageToken | Optional page token for pagination  | `pageToken=DAEDAAAGlQ...` |
| reverse   | Optional reverse order flag         | `reverse=true`            |

**Example**

```bash
curl http://127.0.0.1:3381/v1/linksByFid?fid=6833
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_LINK_ADD",
        "fid": 6833,
        "timestamp": 61144470,
        "network": "FARCASTER_NETWORK_MAINNET",
        "linkBody": {
          "type": "follow",
          "targetFid": 83
        }
      },
      "hash": "0x094e35891519c0e04791a6ba4d2eb63d17462f02",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "qYsfX08mS...McYq6IYMl+ECw==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x0852c0...a06e999cdd"
    }
  ],
  "nextPageToken": ""
}
```

## linksByTargetFid

Get all links to a target FID

**Query Parameters**
| Parameter  | Description                         | Example                   |
| ---------- | ----------------------------------- | ------------------------- |
| target_fid | The FID of the link's target        | `target_fid=6833`         |
| link_type  | The type of link, as a string value | `link_type=follow`        |
| pageSize   | Optional page size (default: 1000)  | `pageSize=100`            |
| pageToken  | Optional page token for pagination  | `pageToken=DAEDAAAGlQ...` |
| reverse    | Optional reverse order flag         | `reverse=true`            |

**Example**

```bash
curl http://127.0.0.1:3381/v1/linksByTargetFid?target_fid=6833
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_LINK_ADD",
        "fid": 302,
        "timestamp": 61144668,
        "network": "FARCASTER_NETWORK_MAINNET",
        "linkBody": {
          "type": "follow",
          "targetFid": 6833
        }
      },
      "hash": "0x78c62531d96088f640ffe7e62088b49749efe286",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "frIZJGIizv...qQd9QJyCg==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x59a04...6860ddfab"
    }
  ],
  "nextPageToken": ""
}
```
# UserData API

The UserData API will accept the following values for the `user_data_type` field.

| String                  | Numerical value | Description                   |
| ----------------------- | --------------- | ----------------------------- |
| USER_DATA_TYPE_PFP      | 1               | Profile Picture for the user  |
| USER_DATA_TYPE_DISPLAY  | 2               | Display Name for the user     |
| USER_DATA_TYPE_BIO      | 3               | Bio for the user              |
| USER_DATA_TYPE_URL      | 5               | URL of the user               |
| USER_DATA_TYPE_USERNAME | 6               | Preferred Name for the user   |
| USER_DATA_TYPE_LOCATION | 7               | Location for the user         |
| USER_DATA_TYPE_TWITTER  | 8               | Twitter username for the user |
| USER_DATA_TYPE_GITHUB   | 9               | GitHub username for the user  |

See [FIP-196](https://github.com/farcasterxyz/protocol/discussions/196) for more information on Location.
See [FIP-19](https://github.com/farcasterxyz/protocol/discussions/199) for more information on Twitter/X and Github usernames.

## userDataByFid

Get UserData for a FID.

**Query Parameters**
| Parameter      | Description                                                                                                                  | Example                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| fid            | The FID that's being requested                                                                                               | `fid=6833`                                                    |
| user_data_type | The type of user data, either as a numerical value or type string. If this is omitted, all user data for the FID is returned | `user_data_type=1` OR `user_data_type=USER_DATA_TYPE_DISPLAY` |
| pageSize       | Optional page size (default: 1000)                                                                                           | `pageSize=100`                                                |
| pageToken      | Optional page token for pagination                                                                                           | `pageToken=DAEDAAAGlQ...`                                     |
| reverse        | Optional reverse order flag                                                                                                  | `reverse=true`                                                |

**Example**

```bash
curl http://127.0.0.1:3381/v1/userDataByFid?fid=6833&user_data_type=1
```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_USER_DATA_ADD",
    "fid": 6833,
    "timestamp": 83433831,
    "network": "FARCASTER_NETWORK_MAINNET",
    "userDataBody": {
      "type": "USER_DATA_TYPE_PFP",
      "value": "https://i.imgur.com/HG54Hq6.png"
    }
  },
  "hash": "0x327b8f47218c369ae01cc453cc23efc79f10181f",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "XITQZD7q...LdAlJ9Cg==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x0852...6e999cdd"
}
```
# Username Proofs API

## userNameProofByName

Get an proof for a username by the Farcaster username

**Query Parameters**
| Parameter | Description                           | Example                           |
| --------- | ------------------------------------- | --------------------------------- |
| name      | The Farcaster username or ENS address | `name=adityapk` OR `name=dwr.eth` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/userNameProofByName?name=adityapk
```

**Response**

```json
{
  "timestamp": 1670603245,
  "name": "adityapk",
  "owner": "Oi7uUaECifDm+larm+rzl3qQhcM=",
  "signature": "fo5OhBP/ud...3IoJdhs=",
  "fid": 6833,
  "type": "USERNAME_TYPE_FNAME"
}
```

## userNameProofsByFid

Get a list of proofs provided by an FID

**Query Parameters**
| Parameter | Description                        | Example                   |
| --------- | ---------------------------------- | ------------------------- |
| fid       | The FID being requested            | `fid=2`                   |
| pageSize  | Optional page size (default: 1000) | `pageSize=100`            |
| pageToken | Optional page token for pagination | `pageToken=DAEDAAAGlQ...` |
| reverse   | Optional reverse order flag        | `reverse=true`            |

**Example**

```bash
curl http://127.0.0.1:3381/v1/userNameProofsByFid?fid=2
```

**Response**

```json
{
  "proofs": [
    {
      "timestamp": 1623910393,
      "name": "v",
      "owner": "0x4114e33eb831858649ea3702e1c9a2db3f626446",
      "signature": "bANBae+Ub...kr3Bik4xs=",
      "fid": 2,
      "type": "USERNAME_TYPE_FNAME"
    },
    {
      "timestamp": 1690329118,
      "name": "varunsrin.eth",
      "owner": "0x182327170fc284caaa5b1bc3e3878233f529d741",
      "signature": "zCEszPt...zqxTiFqVBs=",
      "fid": 2,
      "type": "USERNAME_TYPE_ENS_L1"
    }
  ]
}
```
# Verifications API

## verificationsByFid

Get a list of verifications provided by an FID

**Query Parameters**
| Parameter | Description                           | Example                                              |
| --------- | ------------------------------------- | ---------------------------------------------------- |
| fid       | The FID being requested               | `fid=2`                                              |
| address   | The optional ETH address to filter by | `address=0x91031dcfdea024b4d51e775486111d2b2a715871` |
| pageSize  | Optional page size (default: 1000)    | `pageSize=100`                                       |
| pageToken | Optional page token for pagination    | `pageToken=DAEDAAAGlQ...`                            |
| reverse   | Optional reverse order flag           | `reverse=true`                                       |

**Example**

```bash
curl http://127.0.0.1:3381/v1/verificationsByFid?fid=2
```

**Response**

```json
{
  "messages": [
    {
      "data": {
        "type": "MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS",
        "fid": 2,
        "timestamp": 73244540,
        "network": "FARCASTER_NETWORK_MAINNET",
        "verificationAddEthAddressBody": {
          "address": "0x91031dcfdea024b4d51e775486111d2b2a715871",
          "ethSignature": "tyxj1...x1cYzhyxw=",
          "blockHash": "0xd74860c4bbf574d5ad60f03a478a30f990e05ac723e138a5c860cdb3095f4296"
        }
      },
      "hash": "0xa505331746ec8c5110a94bdb098cd964e43a8f2b",
      "hashScheme": "HASH_SCHEME_BLAKE3",
      "signature": "bln1zIZM.../4riB9IVBQ==",
      "signatureScheme": "SIGNATURE_SCHEME_ED25519",
      "signer": "0x78ff9...b6d62558c"
    }
  ],
  "nextPageToken": ""
}
```
# Message API

The Message API lets you validate and submit signed Farcaster protocol messages to the Hub. Note that the message has to
be sent as the encoded bytestream of the protobuf (`Message.encode(msg).finish()` in typescript), as POST data to the
endpoint.

The encoding of the POST data has to be set to `application/octet-stream`. The endpoint returns the Message object as
JSON if it was successfully submitted or validated

## submitMessage

Submit a signed protobuf-serialized message to the Hub

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitMessage" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"

```

**Response**

```json
{
  "data": {
    "type": "MESSAGE_TYPE_CAST_ADD",
    "fid": 2,
    "timestamp": 48994466,
    "network": "FARCASTER_NETWORK_MAINNET",
    "castAddBody": {
      "embedsDeprecated": [],
      "mentions": [],
      "parentCastId": {
        "fid": 226,
        "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
      },
      "text": "Cast Text",
      "mentionsPositions": [],
      "embeds": []
    }
  },
  "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
  "hashScheme": "HASH_SCHEME_BLAKE3",
  "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
  "signatureScheme": "SIGNATURE_SCHEME_ED25519",
  "signer": "0x78ff9a...58c"
}
```


## submitBulkMessages

Submit several signed protobuf-serialized messages to the Hub at once. Each one will be submitted to the node sequentially.

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitBulkMessages" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@SubmitBulkMessagesRequest.encoded.protobuf"

```

**Response**

```json
[
  {
    "data": {
      "type": "MESSAGE_TYPE_CAST_ADD",
      "fid": 2,
      "timestamp": 48994466,
      "network": "FARCASTER_NETWORK_MAINNET",
      "castAddBody": {
        "embedsDeprecated": [],
        "mentions": [],
        "parentCastId": {
          "fid": 226,
          "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
        },
        "text": "Cast Text",
        "mentionsPositions": [],
        "embeds": []
      }
    },
    "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
    "hashScheme": "HASH_SCHEME_BLAKE3",
    "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
    "signatureScheme": "SIGNATURE_SCHEME_ED25519",
    "signer": "0x78ff9a...58c"
  },
  { // ....
  }
]
```

### Auth

If the rpc auth has been enabled on the server (using `--rpc-auth username:password`), you will need to also pass in the
username and password while calling `submitMessage` or `submitBulkMessages` using HTTP Basic Auth.

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/submitMessage" \
     -u "username:password" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"
```

**JS Example**

```Javascript
import axios from "axios";

const url = `http://127.0.0.1:3381/v1/submitMessage`;

const postConfig = {
  headers: { "Content-Type": "application/octet-stream" },
  auth: { username: "username", password: "password" },
};

// Encode the message into a Buffer (of bytes)
const messageBytes = Buffer.from(Message.encode(castAdd).finish());

try {
  const response = await axios.post(url, messageBytes, postConfig);
} catch (e) {
  // handle errors...
}
```

## validateMessage

Validate a signed protobuf-serialized message with the Hub. This can be used to verify that the hub will consider the
message valid. Or to validate message that cannot be submitted (e.g. Frame actions)

::: details
The hub validates the following for all messages:

- The fid is registered
- The signer is active and registered to the fid
- The message hash is correct
- The signature is valid and corresponds to the signer
- Any other message specific validation

For FrameAction messages, note that the hub does not validate the castId is actually an existing cast. Nor
does it validate the frame url matches the embedded url in the cast. Make sure to check for this if it's
important for your application.

:::

**Query Parameters**
| Parameter | Description                         | Example |
| --------- | ----------------------------------- | ------- |
|           | This endpoint accepts no parameters |         |

**Example**

```bash
curl -X POST "http://127.0.0.1:3381/v1/validateMessage" \
     -H "Content-Type: application/octet-stream" \
     --data-binary "@message.encoded.protobuf"

```

**Response**

```json
{
  "valid": true,
  "message": {
    "data": {
      "type": "MESSAGE_TYPE_FRAME_ACTION",
      "fid": 2,
      "timestamp": 48994466,
      "network": "FARCASTER_NETWORK_MAINNET",
      "frameActionBody": {
        "url": "https://fcpolls.com/polls/1",
        "buttonIndex": 2,
        "inputText": "",
        "castId": {
          "fid": 226,
          "hash": "0xa48dd46161d8e57725f5e26e34ec19c13ff7f3b9"
        }
      }
    },
    "hash": "0xd2b1ddc6c88e865a33cb1a565e0058d757042974",
    "hashScheme": "HASH_SCHEME_BLAKE3",
    "signature": "3msLXzxB4eEYe...dHrY1vkxcPAA==",
    "signatureScheme": "SIGNATURE_SCHEME_ED25519",
    "signer": "0x78ff9a...58c"
  }
}
```

## Using with Rust, Go or other programming languages

Messages need to be signed with a Ed25519 account key belonging to the FID. If you are using a different programming
language
than Typescript, you can manually construct the `MessageData` object and serialize it to the `data_bytes` field of the
message. Then, use the `data_bytes` to compute the `hash` and `signature`. Please see
the [`rust-submitmessage` example](https://github.com/farcasterxyz/hub-monorepo/tree/main/packages/hub-web/examples) for
more details

```rust
use ed25519_dalek::{SecretKey, Signer, SigningKey};
use hex::FromHex;
use reqwest::Client;

use message::{CastAddBody, FarcasterNetwork, MessageData};
use protobuf::Message;


#[tokio::main]
async fn main() {
    let fid = 6833; // FID of the user submitting the message
    let network = FarcasterNetwork::FARCASTER_NETWORK_MAINNET;

    // Construct the cast add message
    let mut cast_add = CastAddBody::new();
    cast_add.set_text("Welcome to Rust!".to_string());

    // Construct the cast add message data object
    let mut msg_data = MessageData::new();
    msg_data.set_field_type(message::MessageType::MESSAGE_TYPE_CAST_ADD);
    msg_data.set_fid(fid);
    msg_data.set_timestamp(
        (std::time::SystemTime::now()
            .duration_since(FARCASTER_EPOCH)
            .unwrap()
            .as_secs()) as u32,
    );
    msg_data.set_network(network);
    msg_data.set_cast_add_body(cast_add);

    let msg_data_bytes = msg_data.write_to_bytes().unwrap();

    // Calculate the blake3 hash, trucated to 20 bytes
    let hash = blake3::hash(&msg_data_bytes).as_bytes()[0..20].to_vec();

    // Construct the actual message
    let mut msg = message::Message::new();
    msg.set_hash_scheme(message::HashScheme::HASH_SCHEME_BLAKE3);
    msg.set_hash(hash);

    // Sign the message. You need to use a signing key that corresponds to the FID you are adding.
    // REPLACE THE PRIVATE KEY WITH YOUR OWN
    let private_key = SigningKey::from_bytes(
        &SecretKey::from_hex("0x...").expect("Please provide a valid private key"),
    );
    let signature = private_key.sign(&msg_data_bytes).to_bytes();

    msg.set_signature_scheme(message::SignatureScheme::SIGNATURE_SCHEME_ED25519);
    msg.set_signature(signature.to_vec());
    msg.set_signer(private_key.verifying_key().to_bytes().to_vec());

    // Serialize the message
    msg.set_data_bytes(msg_data_bytes.to_vec());
    let msg_bytes = msg.write_to_bytes().unwrap();

    // Finally, submit the message to the network

    // Create a reqwest Client
    let client = Client::new();

    // Define your endpoint URL
    let url = "http://127.0.0.1:3381/v1/submitMessage";

    // Make the POST request
    let res = client
        .post(url)
        .header("Content-Type", "application/octet-stream")
        .body(msg_bytes)
        .send()
        .await
        .unwrap();

    // Check if it's success
    if res.status().is_success() {
        println!("Successfully sent the message.");
    } else {
        println!("Failed to send the message. HTTP status: {}", res.status());
    }
}

```
# Fids API

## fids

Get a list of all the FIDs

**Query Parameters**
| Parameter | Description                        | Example                   |
| --------- | ---------------------------------- | ------------------------- |
| shard_id  | Required shard ID to query         | `shard_id=1`              |
| pageSize  | Optional page size (default: 1000) | `pageSize=100`            |
| pageToken | Optional page token for pagination | `pageToken=DAEDAAAGlQ...` |
| reverse   | Optional reverse order flag        | `reverse=true`            |

**Example**

```bash
curl http://127.0.0.1:3381/v1/fids?shard_id=1
```

**Response**

```json
{
  "fids": [1, 3, 5, 7, 11, 12, 15, 17, 18, 19, 21, 22, 23, 30, 31, 33, 36, 37, 41, 43, 47, 48, 52, 54, 55, 57, 58, 60, 62, 65, 67, 68, 70, 77, 79, 81, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 99, 106],
  "nextPageToken": "DAEDAAAGlQarXegAAACK"
}
```
# Storage API

## storageLimitsByFid

Get an FID's storage limits.

**Query Parameters**
| Parameter | Description                    | Example    |
| --------- | ------------------------------ | ---------- |
| fid       | The FID that's being requested | `fid=6833` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/storageLimitsByFid?fid=6833
```

**Response**

```json
{
  "limits": [
    {
      "storeType": "Casts",
      "name": "CASTS",
      "limit": 77000,
      "used": 10510,
      "earliestTimestamp": 0,
      "earliestHash": []
    },
    {
      "storeType": "Links",
      "name": "LINKS",
      "limit": 38500,
      "used": 1742,
      "earliestTimestamp": 0,
      "earliestHash": []
    },
    {
      "storeType": "Reactions",
      "name": "REACTIONS",
      "limit": 38500,
      "used": 19578,
      "earliestTimestamp": 0,
      "earliestHash": []
    },
    {
      "storeType": "UserData",
      "name": "USER_DATA",
      "limit": 800,
      "used": 8,
      "earliestTimestamp": 0,
      "earliestHash": []
    },
    {
      "storeType": "Verifications",
      "name": "VERIFICATIONS",
      "limit": 400,
      "used": 7,
      "earliestTimestamp": 0,
      "earliestHash": []
    },
    {
      "storeType": "UsernameProofs",
      "name": "USERNAME_PROOFS",
      "limit": 80,
      "used": 1,
      "earliestTimestamp": 0,
      "earliestHash": []
    }
  ],
  "units": 515,
  "unit_details": [
    {
      "unitType": "UnitTypeLegacy",
      "unitSize": 15
    },
    {
      "unitType": "UnitType2024",
      "unitSize": 1
    },
    {
      "unitType": "UnitType2025",
      "unitSize": 0
    }
  ],
  "tier_subscriptions": [
    {
      "tier_type": "Pro",
      "expires_at": 1781630485
    }
  ]
}
```
# On Chain API

## onChainSignersByFid

Get a list of account keys (signers) provided by an FID

**Query Parameters**
| Parameter | Description                        | Example                                                                     |
| --------- | ---------------------------------- | --------------------------------------------------------------------------- |
| fid       | The FID being requested            | `fid=2`                                                                     |
| signer    | The optional key of signer         | `signer=0x0852c07b5695ff94138b025e3f9b4788e06133f04e254f0ea0eb85a06e999cdd` |
| pageSize  | Optional page size (default: 1000) | `pageSize=100`                                                              |
| pageToken | Optional page token for pagination | `pageToken=DAEDAAAGlQ...`                                                   |
| reverse   | Optional reverse order flag        | `reverse=true`                                                              |

**Example**

```bash
curl http://127.0.0.1:3381/v1/onChainSignersByFid?fid=6833
```

**Response**

```json
{
  "events": [
    {
      "type": "EVENT_TYPE_SIGNER",
      "chainId": 10,
      "blockNumber": 108875854,
      "blockHash": "0xceb1cdc21ee319b06f0455f1cedc0cd4669b471d283a5b2550b65aba0e0c1af0",
      "blockTimestamp": 1693350485,
      "transactionHash": "0x76e20cf2f7c3db4b78f00f6bb9a7b78b0acfb1eca4348c1f4b5819da66eb2bee",
      "logIndex": 2,
      "fid": 6833,
      "signerEventBody": {
        "key": "0x0852c07b5695ff94138b025e3f9b4788e06133f04e254f0ea0eb85a06e999cdd",
        "keyType": 1,
        "eventType": "SIGNER_EVENT_TYPE_ADD",
        "metadata": "AAAAAAAAAAAA...AAAAAAAA",
        "metadataType": 1
      },
      "txIndex": 0
    }
  ]
}
```

## onChainEventsByFid

Get a list of account keys provided by an FID

**Query Parameters**
| Parameter  | Description                                                                    | Example                                                                |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| fid        | The FID being requested                                                        | `fid=2`                                                                |
| event_type | The string value of the event type being requested. This parameter is required | `event_type=EVENT_TYPE_SIGNER` OR `event_type=EVENT_TYPE_STORAGE_RENT` |
| pageSize   | Optional page size (default: 1000)                                             | `pageSize=100`                                                         |
| pageToken  | Optional page token for pagination                                             | `pageToken=DAEDAAAGlQ...`                                              |
| reverse    | Optional reverse order flag                                                    | `reverse=true`                                                         |

The onChainEventsByFid API will accept the following values for the `event_type` field.

| String                     |
| -------------------------- |
| EVENT_TYPE_NONE            |
| EVENT_TYPE_SIGNER          |
| EVENT_TYPE_SIGNER_MIGRATED |
| EVENT_TYPE_ID_REGISTER     |
| EVENT_TYPE_STORAGE_RENT    |
| EVENT_TYPE_TIER_PURCHASE   |

**Example**

```bash
curl http://127.0.0.1:3381/v1/onChainEventsByFid?fid=3&event_type=EVENT_TYPE_SIGNER
```

**Response**

```json
{
  "events": [
    {
      "type": "EVENT_TYPE_SIGNER",
      "chainId": 10,
      "blockNumber": 108875456,
      "blockHash": "0x75fbbb8b2a4ede67ac350e1b0503c6a152c0091bd8e3ef4a6927d58e088eae28",
      "blockTimestamp": 1693349689,
      "transactionHash": "0x36ef79e6c460e6ae251908be13116ff0065960adb1ae032b4cc65a8352f28952",
      "logIndex": 2,
      "fid": 3,
      "signerEventBody": {
        "key": "0xc887f5bf385a4718eaee166481f1832198938cf33e98a82dc81a0b4b81ffe33d",
        "keyType": 1,
        "eventType": "SIGNER_EVENT_TYPE_ADD",
        "metadata": "AAAAAAAAA...AAAAA",
        "metadataType": 1
      },
      "txIndex": 0
    }
  ]
}
```

## onChainIdRegistryEventByAddress

Get a list of on chain events for a given Address

**Query Parameters**
| Parameter | Description                     | Example                                              |
| --------- | ------------------------------- | ---------------------------------------------------- |
| address   | The ETH address being requested | `address=0x74232bf61e994655592747e20bdf6fa9b9476f79` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/onChainIdRegistryEventByAddress?address=0x74232bf61e994655592747e20bdf6fa9b9476f79
```

**Response**

```json
{
  "type": "EVENT_TYPE_ID_REGISTER",
  "chainId": 10,
  "blockNumber": 108874508,
  "blockHash": "0x20d83804a26247ad8c26d672f2212b28268d145b8c1cefaa4126f7768f46682e",
  "blockTimestamp": 1693347793,
  "transactionHash": "0xf3481fc32227fbd982b5f30a87be32a2de1fc5736293cae7c3f169da48c3e764",
  "logIndex": 7,
  "fid": 3,
  "idRegisterEventBody": {
    "to": "0x74232bf61e994655592747e20bdf6fa9b9476f79",
    "eventType": "ID_REGISTER_EVENT_TYPE_REGISTER",
    "from": "0x",
    "recoveryAddress": "0x00000000fcd5a8e45785c8a4b9a718c9348e4f18"
  },
  "txIndex": 0
}
```

## fidAddressType

Get the address type information for a given FID and address

**Query Parameters**
| Parameter | Description              | Example                                              |
| --------- | ------------------------ | ---------------------------------------------------- |
| fid       | The FID being requested  | `fid=2`                                              |
| address   | The ETH address to check | `address=0x91031dcfdea024b4d51e775486111d2b2a715871` |

**Example**

```bash
curl http://127.0.0.1:3381/v1/fidAddressType?fid=2&address=0x91031dcfdea024b4d51e775486111d2b2a715871
```

**Response**

```json
{
  "is_custody": false,
  "is_auth": false,
  "is_verified": true
}
```
# Events API

The events API returns events as they are merged into the Hub, which can be used to listen to Hub activity.

## eventById

Get an event by its Id

**Query Parameters**
| Parameter   | Description                   | Example                    |
| ----------- | ----------------------------- | -------------------------- |
| event_id    | The Hub Id of the event       | `event_id=350909155450880` |
| shard_index | The shard index for the event | `shard_index=1`            |

**Example**

```bash
curl http://127.0.0.1:3381/v1/eventById?event_id=151622205440&shard_index=1

```

**Response**

```json
{
  "type": "HUB_EVENT_TYPE_BLOCK_CONFIRMED",
  "id": 151622205440,
  "blockConfirmedBody": {
    "blockNumber": 9254285,
    "shardIndex": 1,
    "timestamp": 142732801,
    "blockHash": "0x95659381b61ac3cd9fc06e61d9d9c256f8274aaab526cb23ce72856c2017f721",
    "totalEvents": 10
  },
  "blockNumber": 9254285,
  "shardIndex": 1
}
```

## events

Get a page of Hub events

**Query Parameters**
| Parameter     | Description                                                                                  | Example                         |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
| from_event_id | An optional Hub Id to start getting events from. Set it to `0` to start from the first event | `from_event_id=350909155450880` |
| shard_index   | Optional shard index to query                                                                | `shard_index=1`                 |
| stop_id       | Optional stop event ID                                                                       | `stop_id=350909170294785`       |
| pageSize      | Optional page size (default: 1000)                                                           | `pageSize=100`                  |
| pageToken     | Optional page token for pagination                                                           | `pageToken=DAEDAAAGlQ...`       |
| reverse       | Optional reverse order flag                                                                  | `reverse=true`                  |

**Note**
Hubs prune events older than 3 days, so not all historical events can be fetched via this API

**Example**

```bash
curl http://127.0.0.1:3381/v1/events?from_event_id=0

```

**Response**

```json
{
  "events": [
    {
      "type": "HUB_EVENT_TYPE_BLOCK_CONFIRMED",
      "id": 151622205440,
      "blockConfirmedBody": {
        "blockNumber": 9254285,
        "shardIndex": 1,
        "timestamp": 142732801,
        "blockHash": "0x95659381b61ac3cd9fc06e61d9d9c256f8274aaab526cb23ce72856c2017f721",
        "totalEvents": 10
      },
      "blockNumber": 9254285,
      "shardIndex": 1
    },
    {
      "type": "HUB_EVENT_TYPE_MERGE_MESSAGE",
      "id": 151622205441,
      "mergeMessageBody": {
        "message": {
          "data": {
            "type": "MESSAGE_TYPE_REACTION_ADD",
            "fid": 310826,
            "timestamp": 142732800,
            "network": "FARCASTER_NETWORK_MAINNET",
            "reactionBody": {
              "type": "REACTION_TYPE_LIKE",
              "targetCastId": {
                "fid": 1026688,
                "hash": "0xa1162b5d59281733daee1bcd3b810c5259f66ee1"
              }
            }
          },
          "hash": "0xfd4e55bb235fec5cad679182a2c926948d95b7cb",
          "hashScheme": "HASH_SCHEME_BLAKE3",
          "signature": "3N0jZHh46/gXa6uZS+jCbw/9eiOti3MyHNODn7cw5xqo7DBa45rixbzG2QNJtnDmF5XJb+q4GNv/eZF+19qQBw==",
          "signatureScheme": "SIGNATURE_SCHEME_ED25519",
          "signer": "0x217a69e523fbcc51643021d78f9a0fc98ac4e56c7418a2825f0870c81a5d18aa"
        },
        "deletedMessages": []
      },
      "blockNumber": 9254285,
      "shardIndex": 1
    }
  ]
}
```
