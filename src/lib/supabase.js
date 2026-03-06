import { createClient } from '@supabase/supabase-js';

/**
 * @fileoverview supabase.js - Configuración del Cliente de Supabase.
 * Proporciona la instancia centralizada para interactuar con la base de datos,
 * autenticación y almacenamiento de archivos.
 */

/**URL del proyecto de Supabase obtenida de las variables de entorno. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

/**Llave pública (anónima) de Supabase para el acceso desde el cliente. */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Instancia del cliente de Supabase.
 * Utilizada en toda la aplicación para consultas y operaciones de base de datos.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
