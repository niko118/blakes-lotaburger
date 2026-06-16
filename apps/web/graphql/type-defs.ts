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

  type Query {
    appUsers(search: String): [AppUser!]!
    appUser(id: ID!): AppUser
    roles: [Role!]!
    role(id: ID!): Role
  }

  type Mutation {
    createAppUser(input: CreateAppUserInput!): AppUser!
    updateAppUser(id: ID!, input: UpdateAppUserInput!): AppUser!
    deleteAppUser(id: ID!): Boolean!

    createRole(input: CreateRoleInput!): Role!
    updateRole(id: ID!, input: UpdateRoleInput!): Role!
    deleteRole(id: ID!): Boolean!

    changeMyPassword(input: ChangePasswordInput!): ChangePasswordResult!
  }
`;
