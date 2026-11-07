export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_limits: {
        Row: {
          function_name: string;
          per_day: number;
          per_hour: number;
        };
        ComputedFields: never;
        Insert: {
          function_name: string;
          per_day: number;
          per_hour: number;
        };
        Update: {
          function_name?: string;
          per_day?: number;
          per_hour?: number;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          created_at: string;
          function_name: string;
          id: number;
          input_tokens: number | null;
          output_tokens: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          function_name: string;
          id?: never;
          input_tokens?: number | null;
          output_tokens?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          function_name?: string;
          id?: never;
          input_tokens?: number | null;
          output_tokens?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          arm_cm: number | null;
          body_fat_pct: number | null;
          chest_cm: number | null;
          created_at: string;
          hips_cm: number | null;
          id: string;
          measured_on: string;
          notes: string | null;
          photo_path: string | null;
          thigh_cm: number | null;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hips_cm?: number | null;
          id?: string;
          measured_on?: string;
          notes?: string | null;
          photo_path?: string | null;
          thigh_cm?: number | null;
          user_id: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hips_cm?: number | null;
          id?: string;
          measured_on?: string;
          notes?: string | null;
          photo_path?: string | null;
          thigh_cm?: number | null;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      chat_memory: {
        Row: {
          summarized_until: string;
          summary: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          summarized_until: string;
          summary: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          summarized_until?: string;
          summary?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
          workout_log_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
          workout_log_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['chat_role'];
          user_id?: string;
          workout_log_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_workout_log_id_fkey';
            columns: ['workout_log_id'];
            isOneToOne: false;
            referencedRelation: 'workout_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      coach_reports: {
        Row: {
          created_at: string;
          id: string;
          model: string | null;
          payload: NonNullable<Json>;
          period_end: string;
          period_start: string;
          report_type: Database['public']['Enums']['report_type'];
          user_id: string;
          workout_log_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          model?: string | null;
          payload: NonNullable<Json>;
          period_end: string;
          period_start: string;
          report_type: Database['public']['Enums']['report_type'];
          user_id: string;
          workout_log_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          model?: string | null;
          payload?: NonNullable<Json>;
          period_end?: string;
          period_start?: string;
          report_type?: Database['public']['Enums']['report_type'];
          user_id?: string;
          workout_log_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'coach_reports_workout_log_id_fkey';
            columns: ['workout_log_id'];
            isOneToOne: false;
            referencedRelation: 'workout_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          breathing_tip_fr: string | null;
          category: string;
          common_mistakes_fr: string[];
          created_at: string;
          easier_variant_id: string | null;
          equipment: string[];
          force: string | null;
          gif_url: string | null;
          harder_variant_id: string | null;
          id: string;
          image_urls: string[];
          instructions_en: string[];
          instructions_fr: string[];
          is_reference: boolean | null;
          level: Database['public']['Enums']['fitness_level'];
          license: string | null;
          mechanic: string | null;
          name_en: string;
          name_fr: string;
          primary_muscles: string[];
          search_text: string | null;
          secondary_muscles: string[];
          source: string;
          source_id: string | null;
          updated_at: string;
          video_search_query: string | null;
          youtube_video_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          breathing_tip_fr?: string | null;
          category: string;
          common_mistakes_fr?: string[];
          created_at?: string;
          easier_variant_id?: string | null;
          equipment?: string[];
          force?: string | null;
          gif_url?: string | null;
          harder_variant_id?: string | null;
          id: string;
          image_urls?: string[];
          instructions_en?: string[];
          instructions_fr?: string[];
          is_reference?: never;
          level?: Database['public']['Enums']['fitness_level'];
          license?: string | null;
          mechanic?: string | null;
          name_en: string;
          name_fr: string;
          primary_muscles?: string[];
          search_text?: never;
          secondary_muscles?: string[];
          source?: string;
          source_id?: string | null;
          updated_at?: string;
          video_search_query?: string | null;
          youtube_video_id?: string | null;
        };
        Update: {
          breathing_tip_fr?: string | null;
          category?: string;
          common_mistakes_fr?: string[];
          created_at?: string;
          easier_variant_id?: string | null;
          equipment?: string[];
          force?: string | null;
          gif_url?: string | null;
          harder_variant_id?: string | null;
          id?: string;
          image_urls?: string[];
          instructions_en?: string[];
          instructions_fr?: string[];
          is_reference?: never;
          level?: Database['public']['Enums']['fitness_level'];
          license?: string | null;
          mechanic?: string | null;
          name_en?: string;
          name_fr?: string;
          primary_muscles?: string[];
          search_text?: never;
          secondary_muscles?: string[];
          source?: string;
          source_id?: string | null;
          updated_at?: string;
          video_search_query?: string | null;
          youtube_video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_easier_variant_id_fkey';
            columns: ['easier_variant_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercises_harder_variant_id_fkey';
            columns: ['harder_variant_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_records: {
        Row: {
          achieved_on: string;
          celebrated_at: string | null;
          created_at: string;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          record_type: Database['public']['Enums']['record_type'];
          reps: number | null;
          set_log_id: string | null;
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          achieved_on?: string;
          celebrated_at?: string | null;
          created_at?: string;
          exercise_id: string;
          id?: string;
          load_kg?: number | null;
          record_type: Database['public']['Enums']['record_type'];
          reps?: number | null;
          set_log_id?: string | null;
          user_id: string;
          value: number;
        };
        Update: {
          achieved_on?: string;
          celebrated_at?: string | null;
          created_at?: string;
          exercise_id?: string;
          id?: string;
          load_kg?: number | null;
          record_type?: Database['public']['Enums']['record_type'];
          reps?: number | null;
          set_log_id?: string | null;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_set_log_id_fkey';
            columns: ['set_log_id'];
            isOneToOne: false;
            referencedRelation: 'set_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          birth_year: number | null;
          created_at: string;
          days_per_week: number | null;
          equipment: string[];
          experience: string | null;
          first_name: string | null;
          gdpr_consent_at: string | null;
          health_disclaimer_accepted_at: string | null;
          height_cm: number | null;
          id: string;
          injuries: string[];
          level: Database['public']['Enums']['fitness_level'] | null;
          locale: string;
          location: Database['public']['Enums']['training_location'] | null;
          main_goal: Database['public']['Enums']['training_goal'] | null;
          onboarding_completed_at: string | null;
          preferences: NonNullable<Json>;
          secondary_goals: string[];
          session_minutes: number | null;
          sex: Database['public']['Enums']['sex'] | null;
          timezone: string;
          updated_at: string;
          weight_kg: number | null;
          weight_unit: string;
        };
        ComputedFields: never;
        Insert: {
          birth_year?: number | null;
          created_at?: string;
          days_per_week?: number | null;
          equipment?: string[];
          experience?: string | null;
          first_name?: string | null;
          gdpr_consent_at?: string | null;
          health_disclaimer_accepted_at?: string | null;
          height_cm?: number | null;
          id: string;
          injuries?: string[];
          level?: Database['public']['Enums']['fitness_level'] | null;
          locale?: string;
          location?: Database['public']['Enums']['training_location'] | null;
          main_goal?: Database['public']['Enums']['training_goal'] | null;
          onboarding_completed_at?: string | null;
          preferences?: NonNullable<Json>;
          secondary_goals?: string[];
          session_minutes?: number | null;
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
          weight_unit?: string;
        };
        Update: {
          birth_year?: number | null;
          created_at?: string;
          days_per_week?: number | null;
          equipment?: string[];
          experience?: string | null;
          first_name?: string | null;
          gdpr_consent_at?: string | null;
          health_disclaimer_accepted_at?: string | null;
          height_cm?: number | null;
          id?: string;
          injuries?: string[];
          level?: Database['public']['Enums']['fitness_level'] | null;
          locale?: string;
          location?: Database['public']['Enums']['training_location'] | null;
          main_goal?: Database['public']['Enums']['training_goal'] | null;
          onboarding_completed_at?: string | null;
          preferences?: NonNullable<Json>;
          secondary_goals?: string[];
          session_minutes?: number | null;
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
          weight_unit?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          ai_payload: Json | null;
          created_at: string;
          duration_weeks: number;
          id: string;
          name: string;
          start_date: string;
          status: Database['public']['Enums']['program_status'];
          structure: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ai_payload?: Json | null;
          created_at?: string;
          duration_weeks: number;
          id?: string;
          name: string;
          start_date: string;
          status?: Database['public']['Enums']['program_status'];
          structure?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_payload?: Json | null;
          created_at?: string;
          duration_weeks?: number;
          id?: string;
          name?: string;
          start_date?: string;
          status?: Database['public']['Enums']['program_status'];
          structure?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      set_logs: {
        Row: {
          created_at: string;
          duration_sec: number | null;
          estimated_1rm_kg: number | null;
          exercise_id: string;
          id: string;
          is_warmup: boolean;
          load_kg: number | null;
          performed_at: string;
          reps: number | null;
          rpe: number | null;
          set_number: number;
          user_id: string;
          volume_kg: number | null;
          workout_exercise_id: string | null;
          workout_log_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_sec?: number | null;
          estimated_1rm_kg?: never;
          exercise_id: string;
          id?: string;
          is_warmup?: boolean;
          load_kg?: number | null;
          performed_at?: string;
          reps?: number | null;
          rpe?: number | null;
          set_number: number;
          user_id: string;
          volume_kg?: never;
          workout_exercise_id?: string | null;
          workout_log_id: string;
        };
        Update: {
          created_at?: string;
          duration_sec?: number | null;
          estimated_1rm_kg?: never;
          exercise_id?: string;
          id?: string;
          is_warmup?: boolean;
          load_kg?: number | null;
          performed_at?: string;
          reps?: number | null;
          rpe?: number | null;
          set_number?: number;
          user_id?: string;
          volume_kg?: never;
          workout_exercise_id?: string | null;
          workout_log_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_workout_log_id_fkey';
            columns: ['workout_log_id'];
            isOneToOne: false;
            referencedRelation: 'workout_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          created_at: string;
          duration_sec: number | null;
          exercise_id: string;
          id: string;
          notes: string | null;
          position: number;
          replaced_from: string | null;
          reps: string;
          rest_sec: number | null;
          sets: number;
          suggested_load_kg: number | null;
          target_rpe: number | null;
          tempo: string | null;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_sec?: number | null;
          exercise_id: string;
          id?: string;
          notes?: string | null;
          position: number;
          replaced_from?: string | null;
          reps: string;
          rest_sec?: number | null;
          sets: number;
          suggested_load_kg?: number | null;
          target_rpe?: number | null;
          tempo?: string | null;
          user_id: string;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          duration_sec?: number | null;
          exercise_id?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          replaced_from?: string | null;
          reps?: string;
          rest_sec?: number | null;
          sets?: number;
          suggested_load_kg?: number | null;
          target_rpe?: number | null;
          tempo?: string | null;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_replaced_from_fkey';
            columns: ['replaced_from'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_logs: {
        Row: {
          comment: string | null;
          created_at: string;
          duration_minutes: number | null;
          energy: number | null;
          feeling: number | null;
          finished_at: string | null;
          id: string;
          pains: NonNullable<Json>;
          performed_on: string;
          started_at: string;
          updated_at: string;
          user_id: string;
          workout_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          energy?: number | null;
          feeling?: number | null;
          finished_at?: string | null;
          id?: string;
          pains?: NonNullable<Json>;
          performed_on?: string;
          started_at?: string;
          updated_at?: string;
          user_id: string;
          workout_id?: string | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          energy?: number | null;
          feeling?: number | null;
          finished_at?: string | null;
          id?: string;
          pains?: NonNullable<Json>;
          performed_on?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
          workout_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_logs_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: {
          cooldown: NonNullable<Json>;
          created_at: string;
          estimated_minutes: number | null;
          id: string;
          motivation_message: string | null;
          program_id: string;
          scheduled_date: string;
          status: Database['public']['Enums']['workout_status'];
          title: string;
          updated_at: string;
          user_id: string;
          warmup: NonNullable<Json>;
          week_number: number;
          week_type: Database['public']['Enums']['week_type'];
        };
        ComputedFields: never;
        Insert: {
          cooldown?: NonNullable<Json>;
          created_at?: string;
          estimated_minutes?: number | null;
          id?: string;
          motivation_message?: string | null;
          program_id: string;
          scheduled_date: string;
          status?: Database['public']['Enums']['workout_status'];
          title: string;
          updated_at?: string;
          user_id: string;
          warmup?: NonNullable<Json>;
          week_number: number;
          week_type?: Database['public']['Enums']['week_type'];
        };
        Update: {
          cooldown?: NonNullable<Json>;
          created_at?: string;
          estimated_minutes?: number | null;
          id?: string;
          motivation_message?: string | null;
          program_id?: string;
          scheduled_date?: string;
          status?: Database['public']['Enums']['workout_status'];
          title?: string;
          updated_at?: string;
          user_id?: string;
          warmup?: NonNullable<Json>;
          week_number?: number;
          week_type?: Database['public']['Enums']['week_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'workouts_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      daily_training: {
        Row: {
          day: string;
          minutes: number | null;
          reps: number | null;
          sessions: number | null;
          sets: number | null;
          user_id: string;
          volume_kg: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      exercise_daily_best: {
        Row: {
          best_1rm_kg: number | null;
          best_load_kg: number | null;
          best_reps: number | null;
          day: string;
          exercise_id: string;
          sets: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      coach_history: { Args: { p_limit?: number }; Returns: Json };
      coach_period_metrics: { Args: { p_from: string; p_to: string }; Returns: Json };
      consume_ai_quota: { Args: { p_function: string }; Returns: boolean };
      create_program: { Args: { p_program: Json; p_workouts: Json }; Returns: string };
      detect_personal_records: {
        Args: { p_log_id: string };
        Returns: {
          achieved_on: string;
          celebrated_at: string | null;
          created_at: string;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          record_type: Database['public']['Enums']['record_type'];
          reps: number | null;
          set_log_id: string | null;
          user_id: string;
          value: number;
        }[];
        SetofOptions: {
          from: '*';
          to: 'personal_records';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      exercise_search_text: {
        Args: { muscles: string[]; name_en: string; name_fr: string };
        Returns: string;
      };
      finish_workout: { Args: { p_log: Json }; Returns: Json };
    };
    Enums: {
      chat_role: 'user' | 'assistant';
      fitness_level: 'beginner' | 'intermediate' | 'advanced';
      program_status: 'generating' | 'active' | 'completed' | 'archived';
      record_type: 'max_load' | 'estimated_1rm' | 'max_reps' | 'max_volume';
      report_type: 'session' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'adaptation';
      sex: 'male' | 'female' | 'other';
      training_goal:
        | 'fat_loss'
        | 'muscle_gain'
        | 'strength'
        | 'endurance'
        | 'general_fitness'
        | 'mobility'
        | 'sport_performance';
      training_location: 'gym' | 'home' | 'outdoor';
      week_type: 'adaptation' | 'progression' | 'deload' | 'test';
      workout_status: 'planned' | 'in_progress' | 'completed' | 'skipped';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      chat_role: ['user', 'assistant'],
      fitness_level: ['beginner', 'intermediate', 'advanced'],
      program_status: ['generating', 'active', 'completed', 'archived'],
      record_type: ['max_load', 'estimated_1rm', 'max_reps', 'max_volume'],
      report_type: ['session', 'weekly', 'monthly', 'quarterly', 'yearly', 'adaptation'],
      sex: ['male', 'female', 'other'],
      training_goal: [
        'fat_loss',
        'muscle_gain',
        'strength',
        'endurance',
        'general_fitness',
        'mobility',
        'sport_performance',
      ],
      training_location: ['gym', 'home', 'outdoor'],
      week_type: ['adaptation', 'progression', 'deload', 'test'],
      workout_status: ['planned', 'in_progress', 'completed', 'skipped'],
    },
  },
} as const;
