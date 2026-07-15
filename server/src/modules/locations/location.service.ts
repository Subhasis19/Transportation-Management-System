import { prisma } from "../../lib/prisma";
import type { CreateLocationInput } from "./location.schema";

export async function getLocations() {
    return prisma.location.findMany({ orderBy: { cityName: "asc" } });
}

export async function createLocation(input: CreateLocationInput) {
    return prisma.location.create({ data: { cityName: input.cityName } });
}
