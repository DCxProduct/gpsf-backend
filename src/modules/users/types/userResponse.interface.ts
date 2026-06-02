import { UserType } from "./user.type";
import { Action } from "@/modules/roles/enums/actions.enum";
import { Resource } from "@/modules/roles/enums/resource.enum";

export interface IUserResponse {
    user: UserType & {
        token: string;
        refreshToken?: string;
        permissions?: Partial<Record<Resource, Action[]>>;
    };
    // Telemetry for the frontend so cookies can be set with a matching maxAge
    // (and the UI can hide / show the "Remember me" indicator).
    meta?: {
        accessTokenExpiresIn?: number;
        refreshTokenExpiresIn?: number;
        rememberMe?: boolean;
    };
}
