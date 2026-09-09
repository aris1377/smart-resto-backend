/**
 * Access token ichidagi yagona maʼlumot.
 * Rol/filial ataylab yozilmaydi — ular har soʻrovda bazadan oʻqiladi,
 * aks holda xodim boshqa filialga oʻtkazilsa token eski qiymat bilan qolardi.
 */
export interface JwtPayload {
  sub: number;
}
