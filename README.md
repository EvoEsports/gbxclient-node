# gbxclient-node

Trackmania dedicated server xmlrpc client for nodejs using await/async interface.

# Requiring

    npm install @evotm/gbxclient --save

# Example

```js
import { GbxClient } from "@evotm/gbxclient";
const port = 5001;

async function main() {
  const gbx = new GbxClient();
  
  let status = await gbx.connect("127.0.0.1", port);
  if (status) {
    console.log("connected!");
  }
  await gbx.call("SetApiVersion", "2023-04-24");
  await gbx.call("EnableCallbacks", true);
  try {
    await gbx.call("Authenticate", "SuperAdmin", "SuperAdmin");
  } catch (e) {
    console.log("Authenticate to server failed.");
    console.log(e.message);
    process.exit();
  }

  /*
      shortcut to call script methods easily, this will invoke
      gbx.call("TriggerModeScriptEventArray", method, params);
  */
  await gbx.callScript("XmlRpc.EnableCallbacks", "true");

  // multicall example
  let response = await gbx.multicall([
    ["GetMapList", -1, 0],
    ["GetSystemInfo"],
  ]);
  // you can access GetMapList as response[0] and system infos as response[1]
  // to get all callbacks the server sends
  console.log(response);

  // generic for all callbacks
  gbx.on("callback", (callback, data) => {
    console.log(callback, data);
  });

  // on disconnect we could try reconnect
  gbx.on("disconnect", () => {
    console.error("Disconnected from game, retrying in 15 seconds");
    setTimeout(() => {
      main();
    }, 15000);
  });
}

main();
```
