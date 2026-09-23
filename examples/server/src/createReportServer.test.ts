import { expect, test } from "vitest";

import { createReportServer } from "src/createReportServer";

const listen = async () => {
  const host = createReportServer();

  await new Promise<void>((resolve, reject) => {
    host.server.once("error", reject);
    host.server.listen(0, "127.0.0.1", resolve);
  });

  const address = host.server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP listener.");
  }

  return { ...host, origin: `http://127.0.0.1:${address.port}` };
};

const post = (origin: string, path: string, body: unknown) =>
  fetch(`${origin}/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const report = (id: string) => ({
  id,
  kind: "exception",
  identity: { generation: 1, user: { id: "ada" } },
  tags: { area: "billing" },
});

const readAnswer = async (response: Response) => {
  const body: unknown = await response.json();

  return { status: response.status, body };
};

test("accepts a report and answers with its id", async () => {
  const host = await listen();

  try {
    expect(
      await readAnswer(await post(host.origin, "reports", report("rep_1"))),
    ).toEqual({ status: 202, body: { id: "evt_rep_1" } });
    expect(host.backend.requests.getSnapshot()).toMatchObject([
      { reportId: "rep_1", account: "ada", outcome: "accepted" },
    ]);
  } finally {
    await host.dispose();
  }
});

test("offline answers 503, and the same report is accepted once back online", async () => {
  const host = await listen();

  try {
    await post(host.origin, "control", { offline: true });
    expect((await post(host.origin, "reports", report("rep_2"))).status).toBe(
      503,
    );
    await post(host.origin, "control", { offline: false });
    expect(
      await readAnswer(await post(host.origin, "reports", report("rep_2"))),
    ).toEqual({ status: 202, body: { id: "evt_rep_2" } });
  } finally {
    await host.dispose();
  }
});

test("a repeated report is answered with its first result and received once", async () => {
  const host = await listen();

  try {
    await post(host.origin, "reports", report("rep_3"));
    await post(host.origin, "control", { offline: true });
    expect(
      await readAnswer(await post(host.origin, "reports", report("rep_3"))),
    ).toEqual({ status: 202, body: { id: "evt_rep_3" } });
    expect(host.backend.requests.getSnapshot()).toHaveLength(1);
  } finally {
    await host.dispose();
  }
});

test("a body that is not a report or a known change is refused with 400", async () => {
  const host = await listen();

  try {
    expect((await post(host.origin, "reports", { id: 1 })).status).toBe(400);
    expect(
      (await post(host.origin, "control", { latency: 5, extra: true })).status,
    ).toBe(400);
    expect(host.backend.requests.getSnapshot()).toEqual([]);
  } finally {
    await host.dispose();
  }
});

test("a control change applies to its own server only", async () => {
  const first = await listen();
  const second = await listen();

  try {
    expect(
      await readAnswer(await post(first.origin, "control", { offline: true })),
    ).toEqual({
      status: 200,
      body: { latency: 0, offline: true, failNext: false },
    });
    expect((await post(first.origin, "reports", report("rep_4"))).status).toBe(
      503,
    );
    expect((await post(second.origin, "reports", report("rep_4"))).status).toBe(
      202,
    );
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

test("only the latest thousand accepted reports are remembered as repeats", async () => {
  const host = await listen();

  const lastReceived = () => host.backend.requests.getSnapshot()[0]?.reportId;

  try {
    for (let index = 0; index <= 1_000; index += 1) {
      await post(host.origin, "reports", report(`rep_${index}`));
    }

    // rep_1 is still remembered, so it is answered without being received.
    await post(host.origin, "reports", report("rep_1"));
    expect(lastReceived()).toBe("rep_1000");
    await post(host.origin, "reports", report("rep_0"));
    expect(lastReceived()).toBe("rep_0");
  } finally {
    await host.dispose();
  }
});
