import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      isAdmin: boolean;
      roleId: string | null;
      roleName: string | null;
      permissions: string[];
    };
    maxAgeHours: number;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    name?: string;
    image?: string | null;
    isAdmin?: boolean;
    roleId?: string | null;
    roleName?: string | null;
    permissions?: string[];
  }
}
