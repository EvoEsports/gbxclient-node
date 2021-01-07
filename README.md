# gbxclient-node
Trackmania dedicated server xmlrpc client for nodejs using await/async interface.

# Requiring
    npm install @evotm/gbxclient --save

# Example
```typescript
import { GbxClient } from "@evotm/gbxclient";

async function main() {
    let gbx = new GbxClient();
    await gbx.connect("127.0.0.1", 5001);
    await gbx.call("SetApiVersion", "2013-04-16");
    await gbx.call("EnableCallbacks", true);       

    try {
        await gbx.call("Authenticate", "SuperAdmin", "SuperAdmin");
    } catch (e) {
        console.log("Authenticate to server failed.");
        process.exit(0);
    }
    
    /* 
        shortcut to call script methods easily, this will invoke
        gbx.call("TriggerModeScriptEventArray", method, params);
     */
    await gbx.callScript("XmlRpc.EnableCallbacks", "true");

    // multicall example
    let response = await gbx.multicall([
        ['GetMapList', -1, 0],
        ['GetSystemInfo'],
    ]);
    // you can access GetMapList as response[0] and system infos as response[1]
    console.log(response); 


    // to get all callbacks the server sends
    gbx.on("callback", async (method: string, response: any) => {
        console.log(method, response);
    });

    // to get specific callback
    gbx.on("ManiaPlanet.PlayerChat", async (response: any) => {
        console.log(response);
    });
}

main();
```
