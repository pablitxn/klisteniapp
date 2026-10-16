"""Task-local TCP relay to six pre-existing, restricted fixture HTTP proxies."""
import asyncio,ipaddress,json,pathlib,signal
root=pathlib.Path('/workspace/qa-20261016')
net=next(iter(json.loads((root/'network.json').read_text()).values()))
gateway=json.loads((root/'network-ipam.json').read_text())[0]['Gateway'];client=net['IPAddress']
assert ipaddress.ip_address(gateway).is_private and ipaddress.ip_address(client).is_private
ports=(4342,4344,4346,4350,4352,4354)
async def handle(reader,writer,port):
    peer=writer.get_extra_info('peername')[0]
    if peer not in (client,gateway):
        writer.close();await writer.wait_closed();return
    try:
        upstream_reader,upstream_writer=await asyncio.open_connection('127.0.0.1',port)
    except OSError:
        writer.close();await writer.wait_closed();return
    async def copy(source,target):
        try:
            while data:=await source.read(65536):
                target.write(data);await target.drain()
        except (ConnectionError,OSError):pass
        finally:
            target.close()
    await asyncio.gather(copy(reader,upstream_writer),copy(upstream_reader,writer))
async def main():
    stop=asyncio.Event();loop=asyncio.get_running_loop()
    for sig in (signal.SIGINT,signal.SIGTERM):loop.add_signal_handler(sig,stop.set)
    servers=[]
    try:
        for port in ports:servers.append(await asyncio.start_server(lambda r,w,p=port:handle(r,w,p),gateway,port))
        (root/'relay-ready.json').write_text(json.dumps({'gateway':gateway,'allowedClients':[client,gateway],'targets':[f'127.0.0.1:{p}' for p in ports],'ports':ports,'network':'task-owned internal Docker bridge'},indent=2)+'\n')
        print('Fixture-only internal relay ready',flush=True)
        await stop.wait()
    finally:
        for server in servers:server.close();await server.wait_closed()
asyncio.run(main())
