# HiperNrelaciones

Sitio estático independiente con la matriz de interacciones verificables entre usuarios de HitoFusion.

## Desarrollo local

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.

## Datos

`data/hyperrelations.json` contiene las aristas dirigidas publicadas; `data/records.json`, la evidencia individual sin eliminar; `data/work_units.json`, la vista derivada que agrupa esa evidencia por unidad de trabajo y lote comprobado; `data/productivity.json`, el vector e ICV; y `data/git_activity.json`, la auditoría Git del último corte. La matriz diferencia actor y contraparte y no infiere relaciones por mera co-presencia.

El corte vigente conserva el histórico desde el 9/09/2026 e incorpora el 26/09–13/10 completos y el 14/10 hasta las 11:03:54 de Argentina. Las minutas de `jinzo-work-log/dm/dm-desa` cubren 28–30/09, 1–2/10, 5–9/10 y 13/10; no se infiere actividad de daily para los días sin archivo.

## Índice de Contribución Verificable

Cada persona muestra el vector `[I,H,R,Q,E]`: interacciones, horas, contrapartes únicas, calidad documental por checklist y resultados verificables. El índice usa metas explícitas, saturación y pesos `20/20/15/25/20`. Cuando falta un componente se marca la cobertura incompleta y se reponderan solo los componentes disponibles. Es un indicador operativo de registros observables, no una evaluación laboral.

El dataset se regenera con `node scripts/extract_git.js` y `node scripts/build_metrics.js` a partir de la extracción Odoo estructurada, las referencias Git actualizadas y las dailies. El generador excluye de E los lotes masivos de creación, merges, cuentas técnicas e identidades no verificadas; conserva esos registros para auditoría.
