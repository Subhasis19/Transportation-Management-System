import "../../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import app from "../../app.js";
import { signAccessToken } from "../../lib/auth.js";
import { Role } from "../../generated/prisma/client.js";

const id = "b3fda17e-38c8-4e5f-93c8-a5de06dd4f73";
const paths = ["/admin/locations", "/admin/locations", `/admin/locations/${id}`, `/admin/locations/${id}/status`];

function locationRequest(index: number, path: string) {
  if (index === 0) return request(app).get(path);
  if (index === 1) return request(app).post(path);
  return request(app).patch(path);
}

test("admin location routes reject unauthenticated and malformed requests", async () => {
  for (const [index, path] of paths.entries()) {
    const response = await locationRequest(index, path).send({ cityName: "Puri", isActive: false });
    assert.equal(response.status, 401);
  }
  assert.equal((await request(app).get("/admin/locations").set("Authorization", "Bearer invalid")).status, 401);
  assert.equal((await request(app).get("/locations")).status, 401);
});

for (const role of [Role.CUSTOMER, Role.DRIVER]) {
  test(`${role} cannot access admin location routes`, async () => {
    const token = signAccessToken({ id, role, email: `${role.toLowerCase()}@example.com` });
    for (const [index, path] of paths.entries()) {
      const response = await locationRequest(index, path)
        .set("Authorization", `Bearer ${token}`)
        .send({ cityName: "Puri", isActive: false });
      assert.equal(response.status, 403);
    }
  });
}
