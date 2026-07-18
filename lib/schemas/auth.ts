import { z } from "zod";

/**
 * Auth form şemaları (FE doğrulama). Sunucu tarafı asıl doğrulamayı Supabase
 * Auth yapar; bu şema yalnız erken/istemci geri bildirimi içindir.
 * Hata mesajları i18n anahtarıdır — bileşen `t(issue.message)` ile çözer.
 */
export const emailSchema = z.string().trim().email("auth.errors.email");

export const passwordSchema = z
  .string()
  .min(6, "auth.errors.passwordMin")
  .max(72, "auth.errors.passwordMax"); // bcrypt 72 bayt sınırı

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = signInSchema;

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
