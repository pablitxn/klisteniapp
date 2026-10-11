import { expect, test, type Page } from "@playwright/test";

const password = "browser-tests-only-password-2026";
const atlas = "https://atlas.b2b.test";
async function login(
  page: Page,
  email: string,
  origin = atlas,
  workspace = "/backoffice/",
) {
  await page.goto(`${origin}${workspace}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/b2b/auth/sign-in/email") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    const response = await result;
    if (response.status() !== 429) break;
    // Exercise the real rate limiter: respect its retry window instead of disabling it in fixtures.
    await page.waitForTimeout(
      Math.max(1, Number(response.headers()["retry-after"]) || 60) * 1000,
    );
  }
  await expect(
    page.getByRole("button", { name: "Salir", exact: true }),
  ).toBeVisible();
}
async function select(page: Page, branch: string, role = "admin") {
  await page
    .getByLabel("Sede y función", { exact: true })
    .selectOption(`${branch}:${role}`);
  await expect(page.getByLabel("Sede y función", { exact: true })).toHaveValue(
    `${branch}:${role}`,
  );
}
async function read<T>(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }, path) as Promise<T>;
}

test("administrator creates a branch, grants scoped access, previews/publishes/restores identity and changes branch modules through the UI", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await login(page, "admin@atlas.example.test");
  await select(page, "atlas-demo-principal");
  await page
    .getByRole("button", { name: "Marca y sedes", exact: true })
    .click();
  const name = `Anexo ${testInfo.project.name}`;
  await page.getByLabel("Nombre de sede", { exact: true }).fill(name);
  await page
    .getByLabel("Dirección del enlace", { exact: true })
    .fill(`anexo-${testInfo.project.name}`);
  await page.getByRole("button", { name: "Crear sede", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByLabel("Persona", { exact: true })
    .selectOption({ label: "Atlas Demo Socio" });
  await page.getByLabel("Sede", { exact: true }).selectOption({ label: name });
  await page.getByLabel("Función", { exact: true }).selectOption("member");
  await page
    .getByRole("button", { name: "Conceder acceso", exact: true })
    .click();
  await expect(
    page.getByText(`Atlas Demo Socio · ${name} · Socio`, { exact: true }),
  ).toBeVisible();
  // Restore fixture access after demonstrating a newly authorized branch.
  await page
    .getByText(`Atlas Demo Socio · ${name} · Socio`, { exact: true })
    .locator("..")
    .getByRole("button", { name: "Retirar acceso" })
    .click();
  await expect(
    page.getByText(`Atlas Demo Socio · ${name} · Socio`, { exact: true }),
  ).toHaveCount(0);

  const before = await read<{
    theme: { loginTitle: string };
    themeVersion: number;
  }>(page, "/api/b2b/context");
  await page
    .getByRole("button", { name: "Diseño publicado", exact: true })
    .click();
  const title = `Bienvenida ${testInfo.project.name}`;
  await page.getByLabel("Título de bienvenida", { exact: true }).fill(title);
  await page
    .getByRole("button", { name: "Vista previa privada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  expect(
    (await read<{ theme: { loginTitle: string } }>(page, "/api/b2b/context"))
      .theme.loginTitle,
  ).toBe(before.theme.loginTitle);
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByLabel("Título de bienvenida", { exact: true }),
  ).toHaveValue(title);
  expect(
    (await read<{ theme: { loginTitle: string } }>(page, "/api/b2b/context"))
      .theme.loginTitle,
  ).toBe(before.theme.loginTitle);
  await page
    .getByRole("button", { name: "Publicar diseño", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await read<{ theme: { loginTitle: string } }>(
            page,
            "/api/b2b/context",
          )
        ).theme.loginTitle,
    )
    .toBe(title);
  await expect(
    page.getByText(`Versión publicada ${before.themeVersion + 1}.`, {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Volver a una versión publicada", { exact: true })
    .selectOption(String(before.themeVersion));
  await page
    .getByRole("button", { name: "Restaurar diseño", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await read<{ theme: { loginTitle: string } }>(
            page,
            "/api/b2b/context",
          )
        ).theme.loginTitle,
    )
    .toBe(before.theme.loginTitle);
  await page.getByRole("button", { name: "Módulos", exact: true }).click();
  const equipment = page
    .getByText("Equipamiento y QR", { exact: true })
    .locator("..");
  try {
    await equipment
      .getByRole("checkbox", { name: "Sede actual", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Equipamiento", exact: true }),
    ).toHaveCount(0);
    await equipment
      .getByRole("checkbox", { name: "Sede actual", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Equipamiento", exact: true }),
    ).toBeVisible();
  } finally {
    // Keep the shared fixture usable even when an assertion above fails.
    await page.evaluate(async () => {
      const meResponse = await fetch("/api/b2b/me");
      if (!meResponse.ok)
        throw new Error(`Cleanup session HTTP ${meResponse.status}`);
      const me = await meResponse.json();
      const response = await fetch("/api/b2b/orgs/atlas-demo/modules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Klisteni-B2B-Account": me.user.id,
          "X-Klisteni-B2B-Branch": "atlas-demo-principal",
          "X-Klisteni-B2B-Role": "admin",
        },
        body: JSON.stringify({ module: "equipment", enabled: true }),
      });
      if (!response.ok)
        throw new Error(`Module cleanup HTTP ${response.status}`);
    });
  }
  await page.screenshot({
    path: testInfo.outputPath("brand-and-branch-module-settings.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("switching branches never imports an unsaved routine draft into the other branch and restores it only on return", async ({
  page,
}) => {
  await login(page, "admin@atlas.example.test");
  await select(page, "atlas-demo-principal");
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Crear rutina", exact: true })
    .click();
  await page
    .getByLabel("Nombre de la rutina", { exact: true })
    .fill("Borrador exclusivo de Centro");
  await select(page, "atlas-demo-norte");
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Crear rutina", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre de la rutina", { exact: true }),
  ).toHaveValue("");
  await select(page, "atlas-demo-principal");
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Crear rutina", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar borrador local", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre de la rutina", { exact: true }),
  ).toHaveValue("Borrador exclusivo de Centro");
});

test("coach authors, publishes and prescribes through the UI; members complete it and coaches follow up in all four branches", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(240_000);
  for (const [brand, branch, coach, member] of [
    [
      "atlas",
      "principal",
      "coach@atlas.example.test",
      "member@atlas.example.test",
    ],
    [
      "atlas",
      "norte",
      "coach-norte@atlas.example.test",
      "member-norte@atlas.example.test",
    ],
    ["sur", "principal", "coach@sur.example.test", "member@sur.example.test"],
    [
      "sur",
      "oeste",
      "coach-oeste@sur.example.test",
      "member-oeste@sur.example.test",
    ],
  ]) {
    const origin = `https://${brand}.b2b.test`;
    const name = `Circuito ${brand} ${branch} ${testInfo.project.name}`;
    await context.clearCookies();
    await login(page, coach, origin);
    await page.getByRole("button", { name: "Rutinas", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Crear rutina", exact: true })
      .click();
    await page.getByLabel("Nombre de la rutina", { exact: true }).fill(name);
    // Bodyweight fixtures are available in all branches; their IDs remain stable base content.
    const picker = page.getByLabel("Ejercicio para agregar", { exact: true });
    const movement = await picker
      .locator("option")
      .evaluateAll((options) =>
        options
          .find((option) =>
            option.textContent?.toLowerCase().includes("sentadilla"),
          )
          ?.getAttribute("value"),
      );
    expect(movement).toBeTruthy();
    await picker.selectOption(movement!);
    await page
      .getByRole("button", { name: "+ Agregar movimiento", exact: true })
      .click();
    await page.getByLabel("Series · movimiento 1", { exact: true }).fill("1");
    await page
      .getByRole("button", { name: "Guardar borrador de rutina", exact: true })
      .click();
    await expect(
      page.getByText(
        "Borrador guardado. Podés publicarlo desde la lista de rutinas cuando esté listo.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Volver a rutinas", exact: true })
      .click();
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card
      .getByRole("button", { name: "Publicar versión", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Asignar a socio", exact: true })
      .click();
    const memberPicker = page.getByLabel("Socio destinatario", { exact: true });
    const option = memberPicker.locator("option").filter({ hasText: member });
    await expect(option).toHaveCount(1);
    const recipient = await option.getAttribute("value");
    expect(recipient).toBeTruthy();
    await memberPicker.selectOption(recipient!);
    await page
      .getByRole("button", { name: "Confirmar asignación", exact: true })
      .click();
    await expect(
      page.getByText(
        "Rutina asignada. El socio ya la puede ver en su espacio.",
        { exact: true },
      ),
    ).toBeVisible();
    await context.clearCookies();
    await login(page, member, origin, "/app");
    await page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Empezar sesión", exact: true })
      .click();
    await page.getByRole("checkbox", { name: "Hecha", exact: true }).check();
    await page
      .getByRole("button", { name: "Completar sesión", exact: true })
      .click();
    await expect(
      page.getByText("Tu sesión quedó guardada.", { exact: true }),
    ).toBeVisible();
    await context.clearCookies();
    await login(page, coach, origin);
    await page
      .getByRole("button", { name: "Seguimiento", exact: true })
      .click();
    await expect(
      page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name, exact: true }) }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${brand}-${branch}-coach-followup.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
