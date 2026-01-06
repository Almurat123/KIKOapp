===/docs/overview===
#### Getting started

# Welcome

Welcome to the xAI developer docs! Our API makes it easy to harness Grok's intelligence in your projects. Grok is our flagship AI model designed to deliver truthful, insightful answers.

## Jump right in

Are you a non-developer or simply looking for our consumer services? Visit [Grok.com](https://grok.com) or download one of the [iOS](https://apps.apple.com/us/app/grok/id6670324846) or [Android](https://play.google.com/store/apps/details?id=ai.x.grok) apps. See our [Comparison Table](introduction#xai-api-vs-grok-in-other-services) for the differences.

## Questions and feedback

If you have any questions or feedback, feel free to email us at support@x.ai.

Happy Grokking! 😎


===/docs/overview===
#### Getting started

# Welcome

Welcome to the xAI developer docs! Our API makes it easy to harness Grok's intelligence in your projects. Grok is our flagship AI model designed to deliver truthful, insightful answers.

## Jump right in

Are you a non-developer or simply looking for our consumer services? Visit [Grok.com](https://grok.com) or download one of the [iOS](https://apps.apple.com/us/app/grok/id6670324846) or [Android](https://play.google.com/store/apps/details?id=ai.x.grok) apps. See our [Comparison Table](introduction#xai-api-vs-grok-in-other-services) for the differences.

## Questions and feedback

If you have any questions or feedback, feel free to email us at support@x.ai.

Happy Grokking! 😎


===/docs/tutorial===
#### Getting Started

# The Hitchhiker's Guide to Grok

Welcome! In this guide, we'll walk you through the basics of using the xAI API.

## Step 1: Create an xAI Account

First, you'll need to create an xAI account to access xAI API. Sign up for an account [here](https://accounts.x.ai/sign-up?redirect=cloud-console).

Once you've created an account, you'll need to load it with credits to start using the API.

## Step 2: Generate an API Key

Create an API key via the [API Keys Page](https://console.x.ai/team/default/api-keys) in the xAI API Console.

After generating an API key, we need to save it somewhere safe! We recommend you export it as an environment variable in your terminal or save it to a `.env` file.

```bash
export XAI_API_KEY="your_api_key"
```

## Step 3: Make your first request

With your xAI API key exported as an environment variable, you're ready to make your first API request.

Let's test out the API using `curl`. Paste the following directly into your terminal.

```bash
curl https://api.x.ai/v1/chat/completions \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer $XAI_API_KEY" \\
-m 3600 \\
-d '{
    "messages": [
        {
            "role": "system",
            "content": "You are Grok, a highly intelligent, helpful AI assistant."
        },
        {
            "role": "user",
            "content": "What is the meaning of life, the universe, and everything?"
        }
    ],
    "model": "grok-4",
    "stream": false
}'
```

## Step 4: Make a request from Python or Javascript

As well as a native xAI Python SDK, the majority our APIs are fully compatible with the OpenAI and Anthropic SDKs. For example, we can make the same request from Python or Javascript like so:

```pythonXAI
# In your terminal, first run:
# pip install xai-sdk

import os

from xai_sdk import Client
from xai_sdk.chat import user, system

client = Client(
    api_key=os.getenv("XAI_API_KEY"),
    timeout=3600, # Override default timeout with longer timeout for reasoning models
)

chat = client.chat.create(model="grok-4")
chat.append(system("You are Grok, a highly intelligent, helpful AI assistant."))
chat.append(user("What is the meaning of life, the universe, and everything?"))

response = chat.sample()
print(response.content)
```

```pythonOpenAISDK
# In your terminal, first run:

# pip install openai

import os
import httpx
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
    timeout=httpx.Timeout(3600.0), # Override default timeout with longer timeout for reasoning models
)

completion = client.chat.completions.create(
    model="grok-4",
    messages=[
        {
            "role": "system",
            "content": "You are Grok, a highly intelligent, helpful AI assistant."
        },
        {
            "role": "user",
            "content": "What is the meaning of life, the universe, and everything?"
        },
    ],
)

print(completion.choices[0].message.content)
```

```javascriptAISDK
// In your terminal, first run:
// pnpm add ai @ai-sdk/xai

import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

const result = await generateText({
    model: xai('grok-4'),
    system: 'You are Grok, a highly intelligent, helpful AI assistant.',
    prompt: 'What is the meaning of life, the universe, and everything?',
});

console.log(result.text);
```

```javascriptOpenAISDK
// In your terminal, first run:
// npm install openai

import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: "your_api_key",
    baseURL: "https://api.x.ai/v1",
    timeout: 360000, // Override default timeout with longer timeout for reasoning models
});

const completion = await client.chat.completions.create({
    model: "grok-4",
    messages: [
        {
            role: "system",
            content:
            "You are Grok, a highly intelligent, helpful AI assistant.",
        },
        {
            role: "user",
            content:
            "What is the meaning of life, the universe, and everything?",
        },
    ],
});

console.log(completion.choices[0].message.content);
```

```bash
curl https://api.x.ai/v1/chat/completions \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer $XAI_API_KEY" \\
-m 3600 \\
-d '{
    "messages": [
        {
            "role": "system",
            "content": "You are Grok, a highly intelligent, helpful AI assistant."
        },
        {
            "role": "user",
            "content": "What is the meaning of life, the universe, and everything?"
        }
    ],
    "model": "grok-4"
}'
```

Certain models also support [Structured Outputs](guides/structured-outputs), which allows you to enforce a schema for the LLM output.

For an in-depth guide about using Grok for text responses, check out our [Chat Guide](guides/chat).

## Step 5: Use Grok to analyze images

Certain grok models can accept both text AND images as an input. For example:

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user, image

client = Client(
    api_key=os.getenv("XAI_API_KEY"),
    timeout=3600, # Override default timeout with longer timeout for reasoning models
)

chat = client.chat.create(model="grok-4")
chat.append(
    user(
        "What's in this image?",
        image("https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png")
    )
)

response = chat.sample()
print(response.content)
```

```pythonOpenAISDK
import os
import httpx
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
image_url = "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png"

client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
    timeout=httpx.Timeout(3600.0), # Override default timeout with longer timeout for reasoning models
)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                    "detail": "high",
                },
            },
            {
                "type": "text",
                "text": "What's in this image?",
            },
        ],
    },
]

completion = client.chat.completions.create(
    model="grok-4",
    messages=messages,
)
print(completion.choices[0].message.content)
```

```javascriptAISDK
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

const imageUrl =
'https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png';

const result = await generateText({
    model: xai('grok-4'),
    messages: [
        {
            role: 'user',
            content: [
                { type: 'image', image: imageUrl },
                { text: "What's in this image?", type: 'text' },
            ],
        },
    ],
});

console.log(result.text);
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
    timeout: 360000, // Override default timeout with longer timeout for reasoning models
});

const image_url =
"https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png";

const completion = await client.chat.completions.create({
    model: "grok-4",
    messages: [
        {
            role: "user",
            content: [
                {
                    type: "image_url",
                    image_url: {
                        url: image_url,
                        detail: "high",
                    },
                },
                {
                    type: "text",
                    text: "What's in this image?",
                },
            ],
        },
    ],
});

console.log(completion.choices[0].message.content);
```

```bash
curl https://api.x.ai/v1/chat/completions \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer $XAI_API_KEY" \\
-m 3600 \\
-d '{
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png",
                            "detail": "high"
                        }
                    },
                    {
                        "type": "text",
                        "text": "Describe this image"
                    }
                ]
            }
        ],
        "model": "grok-4"
}'
```

And voila! Grok will tell you exactly what's in the image:

> This image is a photograph of a region in space, specifically a part of the Carina Nebula, captured by the James Webb Space Telescope. It showcases a stunning view of interstellar gas and dust, illuminated by young, hot stars. The bright points of light are stars, and the colorful clouds are composed of various gases and dust particles. The image highlights the intricate details and beauty of star formation within a nebula.

To learn how to use Grok vision for more advanced use cases, check out our [Image Understanding Guide](guides/image-understanding).

## Monitoring usage

As you use your API key, you will be charged for the number of tokens used. For an overview, you can monitor your usage on the [xAI Console Usage Page](https://console.x.ai/team/default/usage).

If you want a more granular, per request usage tracking, the API response includes a usage object that provides detail on prompt (input) and completion (output) token usage.

```json
"usage": {
    "prompt_tokens":37,
    "completion_tokens":530,
    "total_tokens":800,
    "prompt_tokens_details": {
        "text_tokens":37,
        "audio_tokens":0,
        "image_tokens":0,
        "cached_tokens":8
    },
    "completion_tokens_details": {
        "reasoning_tokens":233,
        "audio_tokens":0,
        "accepted_prediction_tokens":0,
        "rejected_prediction_tokens":0
    },
    "num_sources_used":0
}
```

If you send requests too frequently or with long prompts, you might run into rate limits and get an error response. For more information, read [Consumption and Rate Limits](consumption-and-rate-limits).

## Next steps

Now you have learned the basics of making an inference on xAI API. Check out [Models](models) page to start building with one of our latest models.


===/docs/introduction===
#### Introduction

# What is Grok?

Grok is a family of Large Language Models (LLMs) developed by [xAI](https://x.ai).

Inspired by the Hitchhiker's Guide to the Galaxy, Grok is a maximally truth-seeking AI that provides insightful, unfiltered truths about the universe.

xAI offers an API for developers to programmatically interact with our Grok [models](models). The same models power our consumer facing services such as [Grok.com](https://grok.com), the [iOS](https://apps.apple.com/us/app/grok/id6670324846) and [Android](https://play.google.com/store/apps/details?id=ai.x.grok) apps, as well as [Grok in X experience](https://grok.x.com).

## What is the xAI API? How is it different from Grok in other services?

The xAI API is a toolkit for developers to integrate xAI's Grok models into their own applications, the xAI API provides the building blocks to create new AI experiences.

To get started building with the xAI API, please head to [The Hitchhiker's Guide to Grok](tutorial).

## xAI API vs Grok in other services

Because these are separate offerings, your purchase on X (e.g. X Premium) won't affect your service status on xAI API, and vice versa.

This documentation is intended for users using xAI API.


Key Information
Models and Pricing
An overview of our models' capabilities and their associated pricing.

Grok 4.1 Fast
We’re excited to bring you Grok 4.1 Fast, a frontier multimodal model optimized specifically for high-performance agentic tool calling.

Modalities

Context window

2,000,000

Features

Function calling

Structured outputs

Reasoning

Lightning fast

Low cost

View base model
View non-reasoning model
Grok 4.1 Fast
Model Pricing
Model
Modalities

Capabilities

Context

Rate limits

Pricing

Language models		Per million tokens
grok-4-1-fast-reasoning







2,000,000	
4M
tpm
480
rpm

$0.20
$0.50
grok-4-1-fast-non-reasoning







2,000,000	
4M
tpm
480
rpm

$0.20
$0.50
grok-code-fast-1







256,000	
2M
tpm
480
rpm

$0.20
$1.50
grok-4-fast-reasoning







2,000,000	
4M
tpm
480
rpm

$0.20
$0.50
grok-4-fast-non-reasoning







2,000,000	
4M
tpm
480
rpm

$0.20
$0.50
grok-4-0709







256,000	
2M
tpm
480
rpm

$3.00
$15.00
grok-3-mini







131,072	
480
rpm

$0.30
$0.50
grok-3







131,072	
600
rpm

$3.00
$15.00
grok-2-vision-1212







32,768	
600
rpm

$2.00
$10.00
Image generation models		Per image output
grok-2-image-1212







300
rpm

$0.07
Grok 4 Information for Grok 3 Users
When moving from 
grok-3
/
grok-3-mini
 to 
grok-4
, please note the following differences:

• Grok 4 is a reasoning model. There is no non-reasoning mode when using Grok 4.
• 
presencePenalty
, 
frequencyPenalty
 and 
stop
 parameters are not supported by reasoning models. Adding them in the request would result in an error.
• Grok 4 does not have a 
reasoning_effort
 parameter. If a 
reasoning_effort
 is provided, the request will return an error.
Tools Pricing
Requests which make use of xAI provided server-side tools are priced based on two components: token usage and server-side tool invocations. Since the agent autonomously decides how many tools to call, costs scale with query complexity.

Token Costs
All standard token types are billed at the rate for the model used in the request:

Input tokens: Your query and conversation history
Reasoning tokens: Agent's internal thinking and planning
Completion tokens: The final response
Image tokens: Visual content analysis (when applicable)
Cached prompt tokens: Prompt tokens that were served from cache rather than recomputed
Tool Invocation Costs
Tool	Cost per 1,000 calls	Description
Web Search	$5	Internet search and page browsing
X Search	$5	X posts, users, and threads
Code Execution	$5	Python code execution environment
Document Search	$5	Search through uploaded files and documents
View Image	Token-based only	Image analysis within search results
View X Video	Token-based only	Video analysis within X posts
Collections Search	$2.50	Knowledge base search using xAI Collections
Remote MCP Tools	Token-based only	Custom MCP tools
For the view image and view x video tools, you will not be charged for the tool invocation itself but will be charged for the image tokens used to process the image or video.

For Remote MCP tools, you will not be charged for the tool invocation but will be charged for any tokens used.

For more information on using Tools, please visit our guide on Tools.

Live Search Pricing
The advanced agentic search capabilities powering grok.com are generally available in the new agentic tool calling API, and the Live Search API but will be deprecated by December 15, 2025.

Live Search costs $25 per 1,000 sources requested, each source used (Web, X, News, RSS) in a request counts toward the usage. That means a search using 4 sources costs $0.10 while a search using 1 source is $0.025. A source (e.g. Web) may return multiple citations, but you will be charged for only one source.

The number of sources used can be found in the 
response
 object, which contains a field called 
response.usage.num_sources_used
.

For more information on using Live Search, visit our guide on Live Search or look for 
search_parameters
 parameter on API Reference - Chat Completions.

Documents Search Pricing
For users using our Collections API and Documents Search, the following pricing applies:

Item
Price
Documents Search
$2.50/1k requests
File Storage
free
Collections Storage
free
Usage Guidelines Violation Fee
A rare occurrence for most users, when your request is deemed to be in violation of our usage guideline by our system, we will charge a $0.05 per request usage guidelines violation fee.

Additional Information Regarding Models
No access to realtime events without Live Search enabled
Grok has no knowledge of current events or data beyond what was present in its training data.
To incorporate realtime data with your request, please use Live Search function, or pass any realtime data as context in your system prompt.
Chat models
No role order limitation: You can mix 
system
, 
user
, or 
assistant
 roles in any sequence for your conversation context.
Image input models
Maximum image size: 
20MiB
Maximum number of images: No limit
Supported image file types: 
jpg/jpeg
 or 
png
.
Any image/text input order is accepted (e.g. text prompt can precede image prompt)
The knowledge cut-off date of Grok 3 and Grok 4 is November, 2024.

Model Aliases
Some models have aliases to help users automatically migrate to the next version of the same model. In general:

<modelname>
 is aliased to the latest stable version.
<modelname>-latest
 is aliased to the latest version. This is suitable for users who want to access the latest features.
<modelname>-<date>
 refers directly to a specific model release. This will not be updated and is for workflows that demand consistency.
For most users, the aliased 
<modelname>
 or 
<modelname>-latest
 are recommended, as you would receive the latest features automatically.

Billing and Availability
Your model access might vary depending on various factors such as geographical location, account limitations, etc.

For how the bills are charged, visit Manage Billing for more information.

For the most up-to-date information on your team's model availability, visit Models Page on xAI Console.

Model Input and Output
Each model can have one or multiple input and output capabilities. The input capabilities refer to which type(s) of prompt can the model accept in the request message body. The output capabilities refer to which type(s) of completion will the model generate in the response message body.

This is a prompt example for models with 
text
 input capability:

JSON


[
  {
    "role": "system",
    "content": "You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy."
  },
  {
    "role": "user",
    "content": "What is the meaning of life, the universe, and everything?"
  }
]
This is a prompt example for models with 
text
 and 
image
 input capabilities:

JSON


[
  {
    "role": "user",
    "content": [
      {
        "type": "image_url",
        "image_url": {
          "url": "data:image/jpeg;base64,<base64_image_string>",
          "detail": "high"
        }
      },
      {
        "type": "text",
        "text": "Describe what's in this image."
      }
    ]
  }
]
This is a prompt example for models with 
text
 input and 
image
 output capabilities:

JSON


// The entire request body
{
  "model": "grok-4",
  "prompt": "A cat in a tree",
  "n": 4
}
Context Window
The context window determines the maximum amount of tokens accepted by the model in the prompt.

For more information on how token is counted, visit Consumption and Rate Limits.

If you are sending the entire conversation history in the prompt for use cases like chat assistant, the sum of all the prompts in your conversation history must be no greater than the context window.

Cached prompt tokens
Trying to run the same prompt multiple times? You can now use cached prompt tokens to incur less cost on repeated prompts. By reusing stored prompt data, you save on processing expenses for identical requests. Enable caching in your settings and start saving today!

The caching is automatically enabled for all requests without user input. You can view the cached prompt token consumption in the 
"usage"
 object.

For details on the pricing, please refer to the pricing table above, or on xAI Console.
===/docs/guides/function-calling===
#### Guides

# Function calling

Connect the xAI models to external tools and systems to build AI assistants and various integrations.

With stream response, the function call will be returned in whole in a single chunk, instead of
being streamed across chunks.

## Introduction

Function calling enables language models to use external tools, which can intimately connect models to digital and physical worlds.

This is a powerful capability that can be used to enable a wide range of use cases.

* Calling public APIs for actions ranging from looking up football game results to getting real-time satellite positioning data
* Analyzing internal databases
* Browsing web pages
* Executing code
* Interacting with the physical world (e.g. booking a flight ticket, opening your tesla car door, controlling robot arms)

You can call a maximum of 200 tools with function calling.

## Walkthrough

The request/response flow for function calling can be demonstrated in the following illustration.

You can think of it as the LLM initiating [RPCs (Remote Procedure Calls)](https://en.wikipedia.org/wiki/Remote_procedure_call) to user system. From the LLM's perspective, the "2. Response" is an RPC request from LLM to user system, and the "3. Request" is an RPC response with information that LLM needs.

One simple example of a local computer/server, where the computer/server determines if the response from Grok contains a `tool_call`, and calls the locally-defined functions to perform user-defined actions:

The whole process looks like this in pseudocode:

```pseudocode
// ... Define tool calls and their names

messages = []

/* Step 1: Send a new user request */

messages += {<new user request message>}
response = send_request_to_grok(message)

messages += response.choices[0].message  // Append assistant response

while (true) {
    /* Step 2: Run tool call and add tool call result to messages */
    if (response contains tool_call) {
        // Grok asks for tool call

        for (tool in tool_calls) {
            tool_call_result = tool(arguments provided in response) // Perform tool call
            messages += tool_call_result  // Add result to message
        }
    }

    read(user_request)

    if (user_request) {
        messages += {<new user request message>}
    }

    /* Step 3: Send request with tool call result to Grok*/
    response = send_request_to_grok(message)

    print(response)
}

```

We will demonstrate the function calling in the following Python script. First, let's create an API client:

```pythonXAI
import os
import json

from xai_sdk import Client
from xai_sdk.chat import tool, tool_result, user

client = Client(api_key=os.getenv('XAI_API_KEY'))
chat = client.chat.create(model="grok-4")
```

```pythonOpenAISDK
import os
import json
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")

client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
)
```

### Preparation - Define tool functions and function mapping

Define tool functions as callback functions to be called when model requests them in response.

Normally, these functions would either retrieve data from a database, or call another API endpoint, or perform some actions.
For demonstration purposes, we hardcode to return 59° Fahrenheit/15° Celsius as the temperature, and 15,000 feet as the cloud ceiling.

The parameters definition will be sent in the initial request to Grok, so Grok knows what tools and parameters are available to be called.

To reduce human error, you can define the tools partially using Pydantic.

Function definition using Pydantic:

```pythonXAI
from typing import Literal

from pydantic import BaseModel, Field

class TemperatureRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")
    unit: Literal["celsius", "fahrenheit"] = Field(
        "fahrenheit", description="Temperature unit"
    )

class CeilingRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")

def get_current_temperature(request: TemperatureRequest):
    temperature = 59 if request.unit.lower() == "fahrenheit" else 15
    return {
        "location": request.location,
        "temperature": temperature,
        "unit": request.unit,
    }

def get_current_ceiling(request: CeilingRequest):
    return {
        "location": request.location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

# Generate the JSON schema from the Pydantic models

get_current_temperature_schema = TemperatureRequest.model_json_schema()
get_current_ceiling_schema = CeilingRequest.model_json_schema()

# Definition of parameters with Pydantic JSON schema

tool_definitions = [
    tool(
        name="get_current_temperature",
        description="Get the current temperature in a given location",
        parameters=get_current_temperature_schema,
    ),
    tool(
        name="get_current_ceiling",
        description="Get the current cloud ceiling in a given location",
        parameters=get_current_ceiling_schema,
    ),
]
```

```pythonOpenAISDK
from typing import Literal

from pydantic import BaseModel, Field

class TemperatureRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")
    unit: Literal["celsius", "fahrenheit"] = Field(
        "fahrenheit", description="Temperature unit"
    )

class CeilingRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")

def get_current_temperature(request: TemperatureRequest):
    temperature = 59 if request.unit.lower() == "fahrenheit" else 15
    return {
        "location": request.location,
        "temperature": temperature,
        "unit": request.unit,
    }

def get_current_ceiling(request: CeilingRequest):
    return {
        "location": request.location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

# Generate the JSON schema from the Pydantic models

get_current_temperature_schema = TemperatureRequest.model_json_schema()
get_current_ceiling_schema = CeilingRequest.model_json_schema()

# Definition of parameters with Pydantic JSON schema

tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "get_current_temperature",
            "description": "Get the current temperature in a given location",
            "parameters": get_current_temperature_schema,
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_ceiling",
            "description": "Get the current cloud ceiling in a given location",
            "parameters": get_current_ceiling_schema,
        }
    },
]
```

Function definition using raw dictionary:

```pythonXAI
from typing import Literal

def get_current_temperature(location: str, unit: Literal["celsius", "fahrenheit"] = "fahrenheit"):
    temperature = 59 if unit == "fahrenheit" else 15
    return {
        "location": location,
        "temperature": temperature,
        "unit": unit,
    }

def get_current_ceiling(location: str):
    return {
        "location": location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

# Raw dictionary definition of parameters

tool_definitions = [
    tool(
        name="get_current_temperature",
        description="Get the current temperature in a given location",
        parameters={
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "default": "fahrenheit",
                },
            },
            "required": ["location"],
        },
    ),
    tool(
        name="get_current_ceiling",
        description="Get the current cloud ceiling in a given location",
        parameters={
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }
            },
            "required": ["location"],
        },
    ),
]
```

```pythonOpenAISDK
from typing import Literal

def get_current_temperature(location: str, unit: Literal["celsius", "fahrenheit"] = "fahrenheit"):
    temperature = 59 if unit == "fahrenheit" else 15
    return {
        "location": location,
        "temperature": temperature,
        "unit": unit,
    }

def get_current_ceiling(location: str):
    return {
        "location": location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

# Raw dictionary definition of parameters

tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "get_current_temperature",
            "description": "Get the current temperature in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "default": "fahrenheit"
                    }
                },
            "required": ["location"]
        }
    }
},
{
    "type": "function",
    "function": {
    "name": "get_current_ceiling",
    "description": "Get the current cloud ceiling in a given location",
    "parameters": {
    "type": "object",
    "properties": {
    "location": {
    "type": "string",
    "description": "The city and state, e.g. San Francisco, CA"
    }
    },
    "required": ["location"]
    }
    }
}
]
```

Create a string -> function mapping, so we can call the function when model sends it's name. e.g.

```pythonWithoutSDK
tools_map = {
    "get_current_temperature": get_current_temperature,
    "get_current_ceiling": get_current_ceiling,
}
```

### 1. Send initial message

With all the functions defined, it's time to send our API request to Grok!

Now before we send it over, let's look at how the generic request body for a new task looks like.

Here we assume a previous tool call has Note how the tool call is referenced three times:

* By `id` and `name` in "Mesage History" assistant's first response
* By `tool_call_id` in "Message History" tool's content
* In the `tools` field of the request body

Now we compose the request messages in the request body and send it over to Grok. Grok should return a response that asks us for a tool call.

```pythonXAI
chat = client.chat.create(
    model="grok-4",
    tools=tool_definitions,
    tool_choice="auto",
)
chat.append(user("What's the temperature like in San Francisco?"))
response = chat.sample()

# You can inspect the response tool calls which contains a tool call

print(response.tool_calls)
```

```pythonOpenAISDK
messages = [{"role": "user", "content": "What's the temperature like in San Francisco?"}]
response = client.chat.completions.create(
    model="grok-4",
    messages=messages,
    tools=tool_definitions, # The dictionary of our functions and their parameters
    tool_choice="auto",
)

# You can inspect the response which contains a tool call

print(response.choices[0].message)
```

### 2. Run tool functions if Grok asks for tool call and append function returns to message

We retrieve the tool function names and arguments that Grok wants to call, run the functions, and add the result to messages.

At this point, you can choose to **only respond to tool call with results** or **add a new user message request**.

The `tool` message would contain the following:

```json
{
    "role": "tool",
    "content": <json string of tool function's returned object>,
    "tool_call_id": <tool_call.id included in the tool call response by Grok>,
}
```

The request body that we try to assemble and send back to Grok. Note it looks slightly different from the new task request body:

The corresponding code to append messages:

```pythonXAI
# Append assistant message including tool calls to messages
chat.append(response)

# Check if there is any tool calls in response body

# You can also wrap this in a function to make the code cleaner

if response.tool_calls:
    for tool_call in response.tool_calls:

        # Get the tool function name and arguments Grok wants to call
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)

        # Call one of the tool function defined earlier with arguments
        result = tools_map[function_name](**function_args)

        # Append the result from tool function call to the chat message history
        chat.append(tool_result(result))
```

```pythonOpenAISDK
# Append assistant message including tool calls to messages

messages.append(response.choices[0].message)

# Check if there is any tool calls in response body

# You can also wrap this in a function to make the code cleaner

if response.choices[0].message.tool_calls:
    for tool_call in response.choices[0].message.tool_calls:

        # Get the tool function name and arguments Grok wants to call
        function_name = tool_call.function.name
        if function_name not in tools_map:
            messages.append({
                    "role": "tool",
                    "content": json.dumps({"error": f"Function {function_name} not found"}),
                    "tool_call_id": tool_call.id
                })
            continue
        function_args = json.loads(tool_call.function.arguments)

        # Call one of the tool function defined earlier with arguments
        result = tools_map[function_name](**function_args)

        # Append the result from tool function call to the chat message history,
        # with "role": "tool"
        messages.append(
            {
                "role": "tool",
                "content": json.dumps(result),
                "tool_call_id": tool_call.id  # tool_call.id supplied in Grok's response
            })
```

### 3. Send the tool function returns back to the model to get the response

```pythonXAI
response = chat.sample()
print(response.content)
```

```pythonOpenAISDK
response = client.chat.completions.create(
    model="grok-4",
    messages=messages,
    tools=tool_definitions,
    tool_choice="auto"
    )
print(response.choices[0].message.content)
```

### 4. (Optional) Continue the conversation

You can continue the conversation following [Step 2](#2-run-tool-functions-if-grok-asks-for-tool-call-and-append-function-returns-to-message). Otherwise you can terminate.

## Function calling modes

By default, the model will automatically decide whether a function call is necessary and select which functions to call, as determined by the `tool_choice: "auto"` setting.

We offer three ways to customize the default behavior:

1. To force the model to always call one or more functions, you can set `tool_choice: "required"`. The model will then always call function. Note this could force the model to hallucinate parameters.
2. To force the model to call a specific function, you can set `tool_choice: {"type": "function", "function": {"name": "my_function"}}`.
3. To disable function calling and force the model to only generate a user-facing message, you can either provide no tools, or set `tool_choice: "none"`.

## Parallel function calling

By default, parallel function calling is enabled, so you can process multiple function calls in one request/response cycle.
When two or more tool calls are required, all of the tool call requests will be included in the response body. You can disable it by setting `parallel_function_calling : "false"`.

## Complete Example with Vercel AI SDK

The Vercel AI SDK simplifies function calling by handling tool definition, mapping, and execution automatically. Here's a complete example:

```javascriptAISDK
import { xai } from '@ai-sdk/xai';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: xai('grok-4'),
  tools: {
    getCurrentTemperature: tool({
      description: 'Get the current temperature in a given location',
      inputSchema: z.object({
        location: z
          .string()
          .describe('The city and state, e.g. San Francisco, CA'),
        unit: z
          .enum(['celsius', 'fahrenheit'])
          .default('fahrenheit')
          .describe('Temperature unit'),
      }),
      execute: async ({ location, unit }) => {
        const temperature = unit === 'fahrenheit' ? 59 : 15;
        return {
          location,
          temperature,
          unit,
        };
      },
    }),
    getCurrentCeiling: tool({
      description: 'Get the current cloud ceiling in a given location',
      inputSchema: z.object({
        location: z
          .string()
          .describe('The city and state, e.g. San Francisco, CA'),
      }),
      execute: async ({ location }) => {
        return {
          location,
          ceiling: 15000,
          ceiling_type: 'broken',
          unit: 'ft',
        };
      },
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: "What's the temperature like in San Francisco?",
});

for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'text-delta':
      process.stdout.write(chunk.text);
      break;
    case 'tool-call':
      console.log(\`Tool call: \${chunk.toolName}\`, chunk.input);
      break;
    case 'tool-result':
      console.log(\`Tool response: \${chunk.toolName}\`, chunk.output);
      break;
  }
}
```

With the Vercel AI SDK, you don't need to manually:

* Map tool names to functions
* Parse tool call arguments
* Append tool results back to messages
* Handle the request/response cycle

The SDK automatically handles all of these steps, making function calling much simpler.


===/docs/guides/tools/overview===
#### Guides

# Overview

The xAI API supports **agentic server-side tool calling** which enables the model to autonomously explore, search, and execute code to solve complex queries. Unlike traditional tool-calling where clients must handle each tool invocation themselves, xAI's agentic API manages the entire reasoning and tool-execution loop on the server side.

**xAI Python SDK Users**: Version 1.3.1 of the xai-sdk package is required to use the agentic tool calling API.

## Tools Pricing

Agentic requests are priced based on two components: **token usage** and **tool invocations**. Since the agent autonomously decides how many tools to call, costs scale with query complexity.

For more details on Tools pricing, please check out [the pricing page](/docs/models#tools-pricing).

## Agentic Tool Calling

When you provide server-side tools to a request, the xAI server orchestrates an autonomous reasoning loop rather than returning tool calls for you to execute. This creates a seamless experience where the model acts as an intelligent agent that researches, analyzes, and responds automatically.

Behind the scenes, the model follows an iterative reasoning process:

1. **Analyzes the query** and current context to determine what information is needed
2. **Decides what to do next**: Either make a tool call to gather more information or provide a final answer
3. **If making a tool call**: Selects the appropriate tool and parameters based on the reasoning
4. **Executes the tool** in real-time on the server and receives the results
5. **Processes the tool response** and integrates it with previous context and reasoning
6. **Repeats the loop**: Uses the new information to decide whether more research is needed or if a final answer can be provided
7. **Returns the final response** once the agent determines it has sufficient information to answer comprehensively

This autonomous orchestration enables complex multi-step research and analysis to happen automatically, with clients seeing the final result as well as optional real-time progress indicators like tool call notifications during streaming.

## Core Capabilities

* **[Web Search](/docs/guides/tools/search-tools)**: Real-time search across the internet with the ability to both search the web and browse web pages.
* **[X Search](/docs/guides/tools/search-tools)**: Semantic and keyword search across X posts, users, and threads.
* **[Code Execution](/docs/guides/tools/code-execution-tool)**: The model can write and execute Python code for calculations, data analysis, and complex computations.
* **[Image/Video Understanding](/docs/guides/tools/search-tools#parameter-enable_image_understanding-supported-by-web-search-and-x-search)**: Optional visual content understanding and analysis for search results encountered (video understanding is only available for X posts).
* **[Collections Search](/docs/guides/tools/collections-search-tool)**: The model can search through your uploaded knowledge bases and collections to retrieve relevant information.
* **[Remote MCP Tools](/docs/guides/tools/remote-mcp-tools)**: Connect to external MCP servers to access custom tools.
* **[Document Search](/docs/guides/files)**: Upload files and chat with them using intelligent document search. This tool is automatically enabled when you attach files to a chat message.

## Quick Start

We strongly recommend using the xAI Python SDK in streaming mode when using agentic tool calling. Doing so grants you the full feature set of the API, including the ability to get real-time observability and immediate feedback during potentially long-running requests.

Here is a quick start example of using the agentic tool calling API.

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search, x_search, code_execution

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4-1-fast",  # reasoning model
    # All server-side tools active
    tools=[
        web_search(),
        x_search(),
        code_execution(),
    ],
)

# Feel free to change the query here to a question of your liking
chat.append(user("What are the latest updates from xAI?"))

is_thinking = True
for response, chunk in chat.stream():
    # View the server-side tool calls as they are being made in real-time
    for tool_call in chunk.tool_calls:
        print(f"\\nCalling tool: {tool_call.function.name} with arguments: {tool_call.function.arguments}")
    if response.usage.reasoning_tokens and is_thinking:
        print(f"\\rThinking... ({response.usage.reasoning_tokens} tokens)", end="", flush=True)
    if chunk.content and is_thinking:
        print("\\n\\nFinal Response:")
        is_thinking = False
    if chunk.content and not is_thinking:
        print(chunk.content, end="", flush=True)

print("\\n\\nCitations:")
print(response.citations)
print("\\n\\nUsage:")
print(response.usage)
print(response.server_side_tool_usage)
print("\\n\\nServer Side Tool Calls:")
print(response.tool_calls)
```

You will be able to see output like:

```output
Thinking... (270 tokens)
Calling tool: x_user_search with arguments: {"query":"xAI official","count":1}
Thinking... (348 tokens)
Calling tool: x_user_search with arguments: {"query":"xAI","count":5}
Thinking... (410 tokens)
Calling tool: x_keyword_search with arguments: {"query":"from:xai","limit":10,"mode":"Latest"}
Thinking... (667 tokens)
Calling tool: web_search with arguments: {"query":"xAI latest updates site:x.ai","num_results":5}
Thinking... (850 tokens)
Calling tool: browse_page with arguments: {"url": "https://x.ai/news"}
Thinking... (1215 tokens)

Final Response:
### Latest Updates from xAI (as of October 12, 2025)

xAI primarily shares real-time updates via their official X (Twitter) account (@xai), with more formal announcements on their website (x.ai). Below is a summary of the most recent developments...

... full response omitted for brevity

Citations:
[
'https://x.com/i/user/1912644073896206336',
'https://x.com/i/user/1019237602585645057',
'https://x.com/i/status/1975607901571199086',
'https://x.com/i/status/1975608122845896765',
'https://x.com/i/status/1975608070245175592',
'https://x.com/i/user/1603826710016819209',
'https://x.com/i/status/1975608007250829383',
'https://status.x.ai/',
'https://x.com/i/user/150543432',
'https://x.com/i/status/1975608184711880816',
'https://x.com/i/status/1971245659660718431',
'https://x.com/i/status/1975608132530544900',
'https://x.com/i/user/1661523610111193088',
'https://x.com/i/status/1977121515587223679',
'https://x.ai/news/grok-4-fast',
'https://x.com/i/status/1975608017396867282',
'https://x.ai/',
'https://x.com/i/status/1975607953391755740',
'https://x.com/i/user/1875560944044273665',
'https://x.ai/news',
'https://docs.x.ai/docs/release-notes'
]


Usage:
completion_tokens: 1216
prompt_tokens: 29137
total_tokens: 31568
prompt_text_tokens: 29137
reasoning_tokens: 1215
cached_prompt_text_tokens: 22565
server_side_tools_used: SERVER_SIDE_TOOL_X_SEARCH
server_side_tools_used: SERVER_SIDE_TOOL_X_SEARCH
server_side_tools_used: SERVER_SIDE_TOOL_X_SEARCH
server_side_tools_used: SERVER_SIDE_TOOL_WEB_SEARCH
server_side_tools_used: SERVER_SIDE_TOOL_WEB_SEARCH

{'SERVER_SIDE_TOOL_X_SEARCH': 3, 'SERVER_SIDE_TOOL_WEB_SEARCH': 2}


Server Side Tool Calls:
[id: "call_51132959"
function {
  name: "x_user_search"
  arguments: "{\"query\":\"xAI official\",\"count\":1}"
}
, id: "call_00956753"
function {
  name: "x_user_search"
  arguments: "{\"query\":\"xAI\",\"count\":5}"
}
, id: "call_07881908"
function {
  name: "x_keyword_search"
  arguments: "{\"query\":\"from:xai\",\"limit\":10,\"mode\":\"Latest\"}"
}
, id: "call_43296276"
function {
  name: "web_search"
  arguments: "{\"query\":\"xAI latest updates site:x.ai\",\"num_results\":5}"
}
, id: "call_70310550"
function {
  name: "browse_page"
  arguments: "{\"url\": \"https://x.ai/news\"}"
}
]
```

## Understanding the Agentic Tool Calling Response

The agentic tool calling API provides rich observability into the autonomous research process. This section dives deep into the original code snippet above, covering key ways to effectively use the API and understand both real-time streaming responses and final results:

### Real-time server-side tool calls

When executing agentic requests using streaming, you can observe **every tool call decision** the model makes in real-time via the `tool_calls` attribute on the `chunk` object. This shows the exact parameters the agent chose for each tool invocation, giving you visibility into its search strategy. Occasionally the model may decide to invoke multiple tools in parallel during a single turn, in which case each entry in the list of `tool_calls` would represent one of those parallel tool calls; otherwise, only a single entry would be present in `tool_calls`.

**Note**: Only the tool call invocations themselves are shown - **server-side tool call outputs are not returned** in the API response. The agent uses these outputs internally to formulate its final response, but they are not exposed to the user.

When using the xAI Python SDK in streaming mode, it will automatically accumulate the `tool_calls` into the `response` object for you, letting you access a final list of all the server-side tool calls made during the agentic loop. This is demonstrated in the [section below](#server-side-tool-calls-vs-tool-usage).

```pythonWithoutSDK
for tool_call in chunk.tool_calls:
    print(f"\nCalling tool: {tool_call.function.name} with arguments: {tool_call.function.arguments}")
```

```output
Calling tool: x_user_search with arguments: {"query":"xAI official","count":1}
Calling tool: x_user_search with arguments: {"query":"xAI","count":5}
Calling tool: x_keyword_search with arguments: {"query":"from:xai","limit":10,"mode":"Latest"}
Calling tool: web_search with arguments: {"query":"xAI latest updates site:x.ai","num_results":5}
Calling tool: browse_page with arguments: {"url": "https://x.ai/news"}
```

### Citations

The `citations` attribute on the `response` object provides a comprehensive list of URLs for all sources the agent encountered during its search process. They are **only returned when the agentic request completes** and are **not available in real-time** during streaming. Citations are automatically collected from successful tool executions and provide full traceability of the agent's information sources.

Note that not every URL here will necessarily be relevant to the final answer, as the agent may examine a particular source and determine it is not sufficiently relevant to the user's original query.

```pythonWithoutSDK
response.citations
```

```output
[
'https://x.com/i/user/1912644073896206336',
'https://x.com/i/status/1975607901571199086',
'https://x.ai/news',
'https://docs.x.ai/docs/release-notes',
...
]
```

### Server-side Tool Calls vs Tool Usage

The API provides two related but distinct metrics for server-side tool executions:

`tool_calls` - All Attempted Calls

```pythonWithoutSDK
response.tool_calls
```

Returns a list of all **attempted** tool calls made during the agentic process. Each entry is a [ToolCall](https://github.com/xai-org/xai-proto/blob/736b835b0c0dd93698664732daad49f87a2fbc6f/proto/xai/api/v1/chat.proto#L474) object containing:

* `id`: Unique identifier for the tool call
* `function.name`: The name of the specific server-side tool called
* `function.arguments`: The parameters passed to the server-side tool

This includes **every tool call attempt**, even if some fail.

```output
[id: "call_51132959"
function {
  name: "x_user_search"
  arguments: "{\"query\":\"xAI official\",\"count\":1}"
}
, id: "call_07881908"
function {
  name: "x_keyword_search"
  arguments: "{\"query\":\"from:xai\",\"limit\":10,\"mode\":\"Latest\"}"
}
, id: "call_43296276"
function {
  name: "web_search"
  arguments: "{\"query\":\"xAI latest updates site:x.ai\",\"num_results\":5}"
}
]
```

`server_side_tool_usage` - Successful Calls (Billable)

```pythonWithoutSDK
response.server_side_tool_usage
```

Returns a map of successfully executed tools and their invocation counts. This represents only the tool calls that returned meaningful responses and is what determines your billing.

```output
{'SERVER_SIDE_TOOL_X_SEARCH': 3, 'SERVER_SIDE_TOOL_WEB_SEARCH': 2}
```

### Tool Call Function Names vs Usage Categories

The function names in `tool_calls` represent the precise/exact name of the tool invoked by the model, while the entries in `server_side_tool_usage` provide a more high-level categorization that aligns with the original tool passed in the `tools` array of the request.

**Function Name to Usage Category Mapping:**

| Usage Category | Function Name(s) |
|----------------|------------------|
| `SERVER_SIDE_TOOL_WEB_SEARCH` | `web_search`, `web_search_with_snippets`, `browse_page` |
| `SERVER_SIDE_TOOL_X_SEARCH` | `x_user_search`, `x_keyword_search`, `x_semantic_search`, `x_thread_fetch` |
| `SERVER_SIDE_TOOL_CODE_EXECUTION` | `code_execution` |
| `SERVER_SIDE_TOOL_VIEW_X_VIDEO` | `view_x_video` |
| `SERVER_SIDE_TOOL_VIEW_IMAGE` | `view_image` |
| `SERVER_SIDE_TOOL_COLLECTIONS_SEARCH` | `collections_search` |
| `SERVER_SIDE_TOOL_MCP` | `{server_label}.{tool_name}` if `server_label` provided, otherwise `{tool_name}` |

### When Tool Calls and Usage Differ

In most cases, `tool_calls` and `server_side_tool_usage` will show the same tools. However, they can differ when:

* **Failed tool executions**: The model attempts to browse a non-existent webpage, fetch a deleted X post, or encounters other execution errors
* **Invalid parameters**: Tool calls with malformed arguments that can't be processed
* **Network or service issues**: Temporary failures in the tool execution pipeline

The agentic system is robust enough to handle these failures gracefully, updating its trajectory and continuing with alternative approaches when needed.

**Billing Note**: Only successful tool executions (`server_side_tool_usage`) are billed. Failed attempts are not charged.

### Server-side Tool Call and Client-side Tool Call

Agentic tool calling supports mixing server-side tools and client-side tools, which enables more use cases when some private tools and data are needed during the agentic tool calling process.

To determine whether the received tool calls need to be executed by the client side, you can simply check the type of the tool call.

For xAI Python SDK users, you can use the provided `get_tool_call_type` function to get the type of the tool calls.

For a full guide into requests that mix server-side and client-side tools, please check out the [advanced usage](/docs/guides/tools/advanced-usage) page.

**xAI Python SDK Users**: Version 1.4.0 of the xai-sdk package is the minimum requirement to use the `get_tool_call_type` function.

```pythonXAI
# ...
response = chat.sample()

from xai_sdk.tools import get_tool_call_type

for tool_call in response.tool_calls:
    print(get_tool_call_type(tool_call))
```

The available tool call types are listed below:

| Tool call types | Description |
|---------------|-------------|
| `"client_side_tool"` | Indicates this tool call is a **client-side tool** call, and an invocation to this function on the client side is required and the tool output needs to be appended to the chat |
| `"web_search_tool"` | Indicates this tool call is a **web-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"x_search_tool"` | Indicates this tool call is an **x-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"code_execution_tool"` | Indicates this tool call is a **code-execution tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"collections_search_tool"` | Indicates this tool call is a **collections-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"mcp_tool"` | Indicates this tool call is an **MCP tool** call, which is performed by xAI server, **NO** action needed from the client side |

### Understanding Token Usage

Agentic requests have unique token usage patterns compared to standard chat completions. Here's how each token field in the usage object is calculated:

#### `completion_tokens`

Represents **only the final text output** of the model - the comprehensive answer returned to the user. This is typically much smaller than you might expect for such rich, research-driven responses, as the agent performs all its intermediate reasoning and tool orchestration internally.

#### `prompt_tokens`

Represents the **cumulative input tokens** across all inference requests made during the agentic process. Since agentic workflows involve multiple reasoning steps with tool calls, the model makes several inference requests throughout the research process. Each request includes the full conversation history up to that point, which grows as the agent progresses through its research.

While this can result in higher `prompt_tokens` counts, agentic requests benefit significantly from **prompt caching**. The majority of the prompt (the conversation prefix) remains unchanged between inference steps, allowing for efficient caching of the shared context. This means that while the total `prompt_tokens` may appear high, much of the computation is optimized through intelligent caching of the stable conversation history, leading to better cost efficiency overall.

#### `reasoning_tokens`

Represents the tokens used for the model's internal reasoning process during agentic workflows. This includes the computational work the agent performs to plan tool calls, analyze results, and formulate responses, but excludes the final output tokens.

#### `cached_prompt_text_tokens`

Indicates how many prompt tokens were served from cache rather than recomputed. This shows the efficiency gains from prompt caching - higher values indicate better cache utilization and lower costs.

#### `prompt_image_tokens`

Represents the tokens derived from visual content that the agent processes during the request. These tokens are produced when visual understanding is enabled and the agent views images (e.g., via web browsing) or analyzes video frames on X. They are counted separately from text tokens and reflect the cost of ingesting visual features alongside the textual context. If no images or videos are processed, this value will be zero.

#### `prompt_text_tokens` and `total_tokens`

`prompt_text_tokens` reflects the actual text tokens in prompts (excluding any special tokens), while `total_tokens` is the sum of all token types used in the request.

## Synchronous Agentic Requests (Non-streaming)

Although not typically recommended, for simpler use cases or when you want to wait for the complete agentic workflow to finish before processing the response, you can use synchronous requests:

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import code_execution, web_search, x_search

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4-1-fast",  # reasoning model
    tools=[
        web_search(),
        x_search(),
        code_execution(),
    ],
)

chat.append(user("What is the latest update from xAI?"))

# Get the final response in one go once it's ready
response = chat.sample()

print("\\n\\nFinal Response:")
print(response.content)

# Access the citations of the final response
print("\\n\\nCitations:")
print(response.citations)

# Access the usage details from the entire search process
print("\\n\\nUsage:")
print(response.usage)
print(response.server_side_tool_usage)

# Access the server side tool calls of the final response
print("\\n\\nServer Side Tool Calls:")
print(response.tool_calls)
```

Synchronous requests will wait for the entire agentic process to complete before returning the response. This is simpler for basic use cases but provides less visibility into the intermediate steps compared to streaming.

## Using Tools with OpenAI Responses API

We also support using the OpenAI Responses API in both streaming and non-streaming modes.

```pythonOpenAISDK
import os
from openai import OpenAI

api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)

response = client.responses.create(
    model="grok-4-1-fast",
    input=[
        {
            "role": "user",
            "content": "what is the latest update from xAI?",
        },
    ],
    tools=[
        {
            "type": "web_search",
        },
        {
            "type": "x_search",
        },
    ],
)

print(response)
```

```pythonWithoutSDK
import os
import requests

url = "https://api.x.ai/v1/responses"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "model": "grok-4-1-fast",
    "input": [
        {
            "role": "user",
            "content": "what is the latest update from xAI?"
        }
    ],
    "tools": [
        {
            "type": "web_search"
        },
        {
            "type": "x_search"
        }
    ]
}
response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```bash
curl https://api.x.ai/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -d '{
  "model": "grok-4-1-fast",
  "input": [
    {
      "role": "user",
      "content": "what is the latest update from xAI?"
    }
  ],
  "tools": [
    {
      "type": "web_search"
    },
    {
      "type": "x_search"
    }
  ]
}'
```

### Identifying the Client-side Tool Call

A critical step in mixing server-side tools and client-side tools is to identify whether a returned tool call is a client-side tool that needs to be executed locally on the client side.

Similar to the way in xAI Python SDK, you can identify the client-side tool call by checking the `type` of the output entries (`response.output[].type`) in the response of OpenAI Responses API.

| Types | Description |
|---------------|-------------|
| `"function_call"` | Indicates this tool call is a **client-side tool** call, and an invocation to this function on the client side is required and the tool output needs to be appended to the chat |
| `"web_search_call"` | Indicates this tool call is a **web-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"x_search_call"` | Indicates this tool call is an **x-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"code_interpreter_call"` | Indicates this tool call is a **code-execution tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"file_search_call"` | Indicates this tool call is a **collections-search tool** call, which is performed by xAI server, **NO** action needed from the client side |
| `"mcp_call"` | Indicates this tool call is an **MCP tool** call, which is performed by xAI server, **NO** action needed from the client side |

## Agentic Tool Calling Requirements and Limitations

### Model Compatibility

* **Supported Models**: `grok-4`, `grok-4-fast`, `grok-4-fast-non-reasoning`, `grok-4-1-fast`, `grok-4-1-fast-non-reasoning`
* **Strongly Recommended**: `grok-4-1-fast` - specifically trained to excel at agentic tool calling

### Request Constraints

* **No batch requests**: `n > 1` not supported
* **No response format**: Structured output not yet available with agentic tool calling
* **Limited sampling params**: Only `temperature` and `top_p` are respected

**Note**: These constraints may be relaxed in future releases based on user feedback.

## FAQ and Troubleshooting

### I'm seeing empty or incorrect content when using agentic tool calling with the xAI Python SDK

Please make sure to upgrade to the latest version of the xAI SDK. Agentic tool calling requires version `1.3.1` or above.


===/docs/release-notes===
#### What's New?

# Release Notes

Stay up to date with the latest changes to the xAI API.

# November 2025

### Grok 4.1 Fast is available in Enterprise API

You can now use Grok 4.1 Fast in the [xAI Enterprise API](https://x.ai/api). For more details, check out [our blogpost](https://x.ai/news/grok-4-1-fast).

### Agent tools adapt to Grok 4.1 Fast models and tool prices dropped

* You can now use Grok 4.1 Fast models with the agent tools, check out the [documentation of agent tools](/docs/guides/tools/overview) to get started.
* The price of agent tools drops by up to 50% to no more than $5 per 1000 successful calls, see the new prices at [the pricing page](/docs/models#tools-pricing).

### Files API is generally available

You can now upload files and use them in chat conversations with the Files API. For more details, check out [our guide on Files](/docs/guides/files).

### New Tools Available

* **Collections Search Tool**: You can now search through uploaded knowledge bases (collections) in chat conversations via the API. For more details, check out the [docs](/docs/guides/tools/collections-search-tool).
* **Remote MCP Tools**: You can now use tools from remote MCP servers in chat conversations via the API. For more details, check out the [docs](/docs/guides/tools/remote-mcp-tools).
* **Mixing client-side and server-side tools**: You can now mix client-side and server-side tools in the same chat conversation. For more details, check out the [docs](/docs/guides/tools/advanced-usage#mixing-server-side-and-client-side-tools).

# October 2025

### Tools are now generally available

New agentic server-side tools including `web_search`, `x_search` and `code_execution` are available. For more details, check out [our guide on using Tools](/docs/guides/tools/overview).

# September 2025

### Responses API is generally available

You can now use our stateful Responses API to process requests.

# August 2025

### Grok Code Fast 1 is released

We have released our first Code Model to be used with code editors.

### Collections API is released

You can upload files, create embeddings, and use them for inference with our Collections API.

# July 2025

### Grok 4 is released

You can now use Grok 4 via our API or on https://grok.com.

# June 2025

### Management API is released

You can manage your API keys via Management API at
`https://management-api.x.ai`.

# May 2025

### Cached prompt is now available

You can now use cached prompt to save on repeated prompts. For
more info, see [models](models).

### Live Search is available on API

Live search is now available on API. Users can generate
completions with queries on supported data sources.

# April 2025

### Grok 3 models launch on API

Our latest flagship `Grok 3` models are now generally available via
the API. For more info, see [models](models).

# March 2025

### Image Generation Model available on API

The image generation model is available on API. Visit
[Image Generations](/docs/guides/image-generations) for more details on using the model.

# February 2025

### Audit Logs

Team admins can now view audit logs on [console.x.ai](https://console.x.ai).

# January 2025

### Docs Dark Mode Released dark mode support on docs.x.ai

### Status Page Check service statuses across all xAI products at

[status.x.ai](https://status.x.ai/).

# December 2024

### Replit & xAI

Replit Agents can now integrate with xAI! Start empowering your agents with Grok.
Check out the [announcement](https://x.com/Replit/status/1874211039258333643) for more information.

### Tokenizer Playground Understanding tokens can be hard. Check out

[console.x.ai](https://console.x.ai) to get a better understanding of what counts as a token.

### Structured Outputs We're excited to announce that Grok now supports structured outputs. Grok can

now format responses in a predefined, organized format rather than free-form text. 1. Specify the
desired schema

```
{
    "name": "movie_response",
    "schema": {
        "type": "object",
        "properties": {
            "title": { "type": "string" },
            "rating": { "type": "number" },
        },
        "required": [ "title", "rating" ],
        "additionalProperties": false
    },
    "strict": true
}
```

2. Get the desired data

```
{
  "title": "Star Wars",
  "rating": 8.6
}
```

Start building more reliable applications. Check out the [docs](guides/structured-outputs#structured-outputs) for more information.

### Released the new grok-2-1212 and grok-2-vision-1212 models A month ago, we launched the public

beta of our enterprise API with grok-beta and grok-vision-beta. We’re adding [grok-2-1212 and
grok-2-vision-1212](https://docs.x.ai/docs/models), offering better accuracy, instruction-following,
and multilingual capabilities.

# November 2024

### LangChain & xAI Our API is now available through LangChain! - Python Docs:

http://python.langchain.com/docs/integrations/providers/xai/ - Javascript Docs:
http://js.langchain.com/docs/integrations/chat/xai/

What are you going to build?

### API Public Beta Released We are happy to announce the immediate availability of our API, which

gives developers programmatic access to our Grok series of foundation models. To get started, head
to [console.x.ai](https://console.x.ai/) and sign up to create an account. We are excited to see
what developers build using Grok.


