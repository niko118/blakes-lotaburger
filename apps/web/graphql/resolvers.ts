import { dateTimeScalar } from "./resolvers/scalars";
import { appUserResolvers } from "./resolvers/app-user.resolvers";
import { roleResolvers } from "./resolvers/role.resolvers";
import { authResolvers } from "./resolvers/auth.resolvers";
import { reportsResolvers } from "./resolvers/reports.resolvers";

export const resolvers = {
  DateTime: dateTimeScalar,

  Query: {
    ...appUserResolvers.Query,
    ...roleResolvers.Query,
    ...reportsResolvers.Query,
  },

  Mutation: {
    ...appUserResolvers.Mutation,
    ...roleResolvers.Mutation,
    ...authResolvers.Mutation,
    ...reportsResolvers.Mutation,
  },

  AppUser: appUserResolvers.AppUser,
  Role: roleResolvers.Role,
  ReportGroup: reportsResolvers.ReportGroup,
  AccountMapping: reportsResolvers.AccountMapping,
};
