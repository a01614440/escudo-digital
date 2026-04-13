export const rawCoursePlan = {
  planVersion: 4,
  score_name: 'Blindaje Digital',
  planScope: 'standard',
  competencias: {
    web: 42,
    whatsapp: 55,
    sms: 48,
    llamadas: 52,
    correo_redes: 46,
    habitos: 58,
  },
  ruta: [
    {
      id: 'module-web-1',
      categoria: 'web',
      nivel: 'basico',
      titulo: 'Detecta páginas clonadas',
      descripcion: 'Aprende a revisar dominio, pagos y políticas antes de confiar.',
      actividades: [
        {
          id: 'activity-web-1',
          tipo: 'quiz',
          titulo: 'Dominio correcto',
          opciones: ['Escribir el dominio oficial', 'Abrir el enlace del SMS'],
          correcta: 0,
        },
        {
          id: 'activity-web-2',
          tipo: 'scenario_flow',
          titulo: 'Compra con urgencia',
          scenarioId: 'scenario-web-1',
          pasos: [
            {
              texto: 'Te presionan para pagar hoy desde una tienda desconocida.',
              opciones: [
                {
                  id: 'option-1',
                  texto: 'Verifico dominio y política antes de pagar',
                  puntaje: 1,
                  siguiente: 1,
                },
                {
                  id: 'option-2',
                  texto: 'Pago de inmediato para no perder la oferta',
                  puntaje: 0.2,
                  siguiente: 1,
                },
              ],
            },
            {
              texto: 'El sitio pide transferencia bancaria y no muestra razón social.',
              opciones: [
                {
                  id: 'option-3',
                  texto: 'Corto la compra y verifico por fuera',
                  puntaje: 1,
                },
                {
                  id: 'option-4',
                  texto: 'Sigo porque el descuento se ve real',
                  puntaje: 0.2,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
