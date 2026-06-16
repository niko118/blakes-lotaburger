import { GraphQLScalarType, Kind } from "graphql";

// Custom DateTime scalar
export const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "DateTime custom scalar type",
  serialize(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  },
  parseValue(value: unknown) {
    if (typeof value === "string") {
      return new Date(value);
    }
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

