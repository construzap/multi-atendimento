export type Contato = {
  key: string
  name: string | null
  created_at: string | null
  updated_at: string | null
  photo: string | null
  id_canal: number | null
  phone: string | null
  lid: string | null
}

export type ContatosListResponse = {
  data: Contato[]
}

