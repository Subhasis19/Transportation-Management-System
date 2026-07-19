import "../../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import app from "../../app.js";
import { Role } from "../../generated/prisma/client.js";
import { signAccessToken } from "../../lib/auth.js";

const id = "b3fda17e-38c8-4e5f-93c8-a5de06dd4f73";
const paths = [
  "/admin/routes",
  "/admin/routes",
  `/admin/routes/${id}`,
  `/admin/routes/${id}/status`,
];

function routeRequest(index: number, path: string) {
  if (index === 0) return request(app).get(path);
  if (index === 1) return request(app).post(path);
  return request(app).patch(path);
}

test("admin route endpoints require authentication", async () => {
  for (const [index, path] of paths.entries()) {
    assert.equal((await routeRequest(index, path).send({})).status, 401);
  }
  assert.equal((await request(app).get("/quotes")).status, 401);
});

test("admin route endpoints reject malformed bearer tokens", async () => {
  assert.equal(
    (
      await request(app)
        .get("/admin/routes")
        .set("Authorization", "Bearer not-a-token")
    ).status,
    401,
  );
});

test("equal route endpoints return the service validation error before Prisma", async () => {
  const token = signAccessToken({
    id,
    role: Role.ADMIN,
    email: "admin@example.com",
  });
  const response = await request(app)
    .post("/admin/routes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromLocationId: id,
      toLocationId: id,
      distanceKm: 12.5,
      tollAmount: 0,
    });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    message: "Origin and destination must differ",
  });
});

for (const role of [Role.CUSTOMER, Role.DRIVER]) {
  test(`${role} cannot access admin routes`, async () => {
    const token = signAccessToken({
      id,
      role,
      email: `${role.toLowerCase()}@example.com`,
    });

    for (const [index, path] of paths.entries()) {
      assert.equal(
        (
          await routeRequest(index, path)
            .set("Authorization", `Bearer ${token}`)
            .send({})
        ).status,
        403,
      );
    }
  });
}
