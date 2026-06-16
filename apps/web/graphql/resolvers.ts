import { dateTimeScalar } from "./resolvers/scalars";
import { appUserResolvers } from "./resolvers/app-user.resolvers";
import { roleResolvers } from "./resolvers/role.resolvers";
import { authResolvers } from "./resolvers/auth.resolvers";

export const resolvers = {
  DateTime: dateTimeScalar,

  Query: {
    ...appUserResolvers.Query,
    ...roleResolvers.Query,
  },

  Mutation: {
    ...appUserResolvers.Mutation,
    ...roleResolvers.Mutation,
    ...authResolvers.Mutation,
  },

  AppUser: appUserResolvers.AppUser,
  Role: roleResolvers.Role,
};
