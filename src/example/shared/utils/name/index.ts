import { faker } from "@faker-js/faker";

export function name(): string {
  return faker.person.firstName();
}
