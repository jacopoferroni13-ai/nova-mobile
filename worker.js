import * as webllm from "https://esm.run/@mlc-ai/web-llm";
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
