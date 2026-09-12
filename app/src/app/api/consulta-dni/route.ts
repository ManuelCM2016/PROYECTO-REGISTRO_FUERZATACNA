import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni');

    if (!dni) {
      return NextResponse.json(
        { success: false, error: 'El DNI es obligatorio' },
        { status: 400 }
      );
    }

    const cleanDni = dni.replace(/\D/g, '').trim();
    if (cleanDni.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'El DNI debe tener exactamente 8 dígitos' },
        { status: 400 }
      );
    }

    // Usa la variable de entorno o el token asignado por defecto
    const apiToken =
      process.env.DECOLECTA_API_TOKEN?.trim() ||
      'sk_19333.UBG8h18psoccRBccRqpF0q3oA92pTNx1';

    if (!apiToken) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'El token de Decolecta (DECOLECTA_API_TOKEN) no está configurado en el servidor.',
      });
    }

    const targetUrl = `https://api.decolecta.com/v1/reniec/dni?numero=${encodeURIComponent(cleanDni)}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      // Timeout seguro de 8 segundos
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) {
      return NextResponse.json({
        success: false,
        notFound: true,
        error: 'El DNI no fue encontrado en el padrón de RENIEC.',
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Decolecta API error:', response.status, errText);
      return NextResponse.json({
        success: false,
        error: `Error al consultar servicio RENIEC (HTTP ${response.status})`,
      });
    }

    const result = await response.json();

    // Decolecta devuelve:
    // { first_name, first_last_name, second_last_name, full_name, document_number }
    const firstName = String(result.first_name || '').trim().toUpperCase();
    const firstLastName = String(result.first_last_name || '').trim().toUpperCase();
    const secondLastName = String(result.second_last_name || '').trim().toUpperCase();
    const apellidos = [firstLastName, secondLastName].filter(Boolean).join(' ') || String(result.full_name || '').trim().toUpperCase();

    return NextResponse.json({
      success: true,
      data: {
        dni: result.document_number || cleanDni,
        nombres: firstName,
        apellidos: apellidos,
        apellido_paterno: firstLastName,
        apellido_materno: secondLastName,
        nombre_completo: result.full_name || `${apellidos} ${firstName}`,
      },
    });
  } catch (error: unknown) {
    console.error('Error en consulta DNI Decolecta:', error);
    const message = error instanceof Error ? error.message : 'Error interno al consultar DNI';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
