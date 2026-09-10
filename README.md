# HiperNrelaciones

Sitio estático independiente con la matriz de interacciones verificables entre usuarios de HitoFusion.

## Desarrollo local

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.

## Datos

`data/hyperrelations.json` contiene el corte publicado. La matriz diferencia actor y contraparte y no infiere relaciones por mera co-presencia.

## Índice de Contribución Verificable

Cada persona muestra el vector `[I,H,R,Q,E]`: interacciones, horas, contrapartes únicas, calidad documental por checklist y resultados verificables. El índice usa metas explícitas, saturación y pesos `20/20/15/25/20`. Cuando falta un componente se marca la cobertura incompleta y se reponderan solo los componentes disponibles. Es un indicador operativo de registros observables, no una evaluación laboral.

El dataset se regenera con `node scripts/build_metrics.js` a partir de las extracciones Odoo de cada día y del conjunto de interacciones deduplicadas.
