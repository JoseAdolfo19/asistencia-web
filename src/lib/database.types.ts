export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alumnos: {
        Row: {
          apellidos: string
          contrasena_hash: string | null
          correo: string | null
          creado_en: string
          debe_cambiar_password: boolean
          dni: string | null
          estado: string
          id: string
          login_bloqueado_hasta: string | null
          login_intentos: number
          nombres: string
          qr_autorizado: boolean
          registrado: boolean
          rol: string
          salt: string | null
          session_version: number
        }
        Insert: {
          apellidos?: string
          contrasena_hash?: string | null
          correo?: string | null
          creado_en?: string
          debe_cambiar_password?: boolean
          dni?: string | null
          estado?: string
          id: string
          login_bloqueado_hasta?: string | null
          login_intentos?: number
          nombres?: string
          qr_autorizado?: boolean
          registrado?: boolean
          rol?: string
          salt?: string | null
          session_version?: number
        }
        Update: {
          apellidos?: string
          contrasena_hash?: string | null
          correo?: string | null
          creado_en?: string
          debe_cambiar_password?: boolean
          dni?: string | null
          estado?: string
          id?: string
          login_bloqueado_hasta?: string | null
          login_intentos?: number
          nombres?: string
          qr_autorizado?: boolean
          registrado?: boolean
          rol?: string
          salt?: string | null
          session_version?: number
        }
        Relationships: []
      }
      asistencia: {
        Row: {
          alumno: string
          curso: string
          estado: string
          fecha: string
          hora: string
          id: number
          justificada: boolean | null
          motivo_justificacion: string | null
        }
        Insert: {
          alumno: string
          curso: string
          estado: string
          fecha: string
          hora: string
          id?: number
          justificada?: boolean | null
          motivo_justificacion?: string | null
        }
        Update: {
          alumno?: string
          curso?: string
          estado?: string
          fecha?: string
          hora?: string
          id?: number
          justificada?: boolean | null
          motivo_justificacion?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          detalle: string | null
          id: number
          rol: string | null
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: string | null
          id?: number
          rol?: string | null
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: string | null
          id?: number
          rol?: string | null
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: []
      }
      clases_abiertas: {
        Row: {
          curso: string
          docente: string | null
          fecha: string
          hora_abierta: string
          id: number
        }
        Insert: {
          curso: string
          docente?: string | null
          fecha: string
          hora_abierta: string
          id?: number
        }
        Update: {
          curso?: string
          docente?: string | null
          fecha?: string
          hora_abierta?: string
          id?: number
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          id: number
          multa_actividad: number
          multa_buzo: number
          multa_tardanza: number
          tiempo_apertura_qr: number
          tiempo_cierre_qr: number
        }
        Insert: {
          id?: number
          multa_actividad?: number
          multa_buzo?: number
          multa_tardanza?: number
          tiempo_apertura_qr?: number
          tiempo_cierre_qr?: number
        }
        Update: {
          id?: number
          multa_actividad?: number
          multa_buzo?: number
          multa_tardanza?: number
          tiempo_apertura_qr?: number
          tiempo_cierre_qr?: number
        }
        Relationships: []
      }
      cursos: {
        Row: {
          asistencia_obligatoria: boolean
          docente_id: number | null
          horas_semana: number
          id: number
          nombre: string
        }
        Insert: {
          asistencia_obligatoria?: boolean
          docente_id?: number | null
          horas_semana?: number
          id?: number
          nombre: string
        }
        Update: {
          asistencia_obligatoria?: boolean
          docente_id?: number | null
          horas_semana?: number
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      docentes: {
        Row: {
          correo: string | null
          estado: string
          id: number
          nombre: string
          telefono: string | null
        }
        Insert: {
          correo?: string | null
          estado?: string
          id?: number
          nombre?: string
          telefono?: string | null
        }
        Update: {
          correo?: string | null
          estado?: string
          id?: number
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      horario: {
        Row: {
          apertura_qr: string | null
          aula: string | null
          cierre_lista: string | null
          curso: string
          dia: string
          docente: string | null
          hora_fin: string
          hora_inicio: string
          id: number
        }
        Insert: {
          apertura_qr?: string | null
          aula?: string | null
          cierre_lista?: string | null
          curso: string
          dia: string
          docente?: string | null
          hora_fin: string
          hora_inicio: string
          id?: number
        }
        Update: {
          apertura_qr?: string | null
          aula?: string | null
          cierre_lista?: string | null
          curso?: string
          dia?: string
          docente?: string | null
          hora_fin?: string
          hora_inicio?: string
          id?: number
        }
        Relationships: []
      }
      multas: {
        Row: {
          alumno: string
          estado: string
          fecha: string
          id: number
          monto: number
          motivo: string | null
          tipo: string
        }
        Insert: {
          alumno: string
          estado?: string
          fecha: string
          id?: number
          monto?: number
          motivo?: string | null
          tipo: string
        }
        Update: {
          alumno?: string
          estado?: string
          fecha?: string
          id?: number
          monto?: number
          motivo?: string | null
          tipo?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          clave: string
          conteo: number
          ventana_inicio: string
        }
        Insert: {
          clave: string
          conteo?: number
          ventana_inicio?: string
        }
        Update: {
          clave?: string
          conteo?: number
          ventana_inicio?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
