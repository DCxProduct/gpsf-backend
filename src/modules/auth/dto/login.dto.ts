import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {

    @IsEmail()
    readonly email: string;

    @IsString()
    @IsNotEmpty()
    readonly password: string;

    // When true, the access token is signed for 7 days instead of the default 8h.
    @IsOptional()
    @IsBoolean()
    readonly rememberMe?: boolean;
}