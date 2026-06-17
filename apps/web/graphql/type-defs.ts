export const typeDefs = /* GraphQL */ `
  scalar DateTime

  type AppUser {
    id: ID!
    email: String!
    name: String
    isAdmin: Boolean!
    role: Role
    isActive: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Role {
    id: ID!
    name: String!
    description: String
    permissions: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CreateAppUserInput {
    email: String!
    name: String
    password: String!
    isAdmin: Boolean = false
    roleId: ID
    isActive: Boolean = true
  }

  input UpdateAppUserInput {
    name: String
    password: String
    isAdmin: Boolean
    roleId: ID
    isActive: Boolean
  }

  input CreateRoleInput {
    name: String!
    description: String
    permissions: [String!]!
  }

  input UpdateRoleInput {
    name: String
    description: String
    permissions: [String!]
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  type ChangePasswordResult {
    success: Boolean!
  }

  # ---- Report Groups ----

  type ReportGroup {
    id: ID!
    name: String!
    parentId: Int
    reportType: String!
    sortOrder: Int!
    subtotalAfter: Boolean!
    contributesAs: String
    eliminateCommissary: Boolean!
    children: [ReportGroup!]!
  }

  # ---- Account Mappings ----

  type AccountMapping {
    id: ID!
    accountName: String!
    groupId: Int
    group: ReportGroup
    reportType: String
    ignored: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type AccountMappingCheckResult {
    unmappedAccounts: [String!]!
    totalChecked: Int!
  }

  input UpdateAccountMappingInput {
    groupId: Int
    ignored: Boolean
  }

  input CreateReportGroupInput {
    name: String!
    parentId: Int
    reportType: String!
    sortOrder: Int
    subtotalAfter: Boolean
    contributesAs: String
    eliminateCommissary: Boolean
  }

  input UpdateReportGroupInput {
    name: String
    parentId: Int
    sortOrder: Int
    subtotalAfter: Boolean
    contributesAs: String
    eliminateCommissary: Boolean
  }

  # Used to persist drag-and-drop reordering and cross-section moves.
  input ReportGroupOrderInput {
    id: ID!
    sortOrder: Int!
    parentId: Int
  }

  type Query {
    appUsers(search: String): [AppUser!]!
    appUser(id: ID!): AppUser
    roles: [Role!]!
    role(id: ID!): Role

    reportGroups(reportType: String): [ReportGroup!]!
    accountMappings(groupId: Int, unmappedOnly: Boolean): [AccountMapping!]!
    checkAccountMappings(accountNames: [String!]!): AccountMappingCheckResult!
  }

  type Mutation {
    createAppUser(input: CreateAppUserInput!): AppUser!
    updateAppUser(id: ID!, input: UpdateAppUserInput!): AppUser!
    deleteAppUser(id: ID!): Boolean!

    createRole(input: CreateRoleInput!): Role!
    updateRole(id: ID!, input: UpdateRoleInput!): Role!
    deleteRole(id: ID!): Boolean!

    changeMyPassword(input: ChangePasswordInput!): ChangePasswordResult!

    updateAccountMapping(accountName: String!, input: UpdateAccountMappingInput!): AccountMapping!

    createReportGroup(input: CreateReportGroupInput!): ReportGroup!
    updateReportGroup(id: ID!, input: UpdateReportGroupInput!): ReportGroup!
    reorderReportGroups(items: [ReportGroupOrderInput!]!): Boolean!
    deleteReportGroup(id: ID!): Boolean!
  }
`;
