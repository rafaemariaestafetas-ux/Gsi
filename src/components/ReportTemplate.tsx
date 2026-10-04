import React from 'react';
import { TimeEntry } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import watermarkImg from '../assets/images/sea_compass_background_1786386889372.jpg';

interface ReportTemplateProps {
  userName: string;
  userRole: string;
  month: number;
  year: number;
  entries: TimeEntry[];
  totalHours: number;
  totalPayment: number;
}

const ReportTemplate: React.FC<ReportTemplateProps> = ({ 
  userName, 
  userRole, 
  month, 
  year, 
  entries,
  totalHours,
  totalPayment
}) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);

  const getEntryForDay = (day: number) => {
    return entries.find((e) => e.day === day);
  };

  const monthName = format(new Date(year, month), 'MMMM', { locale: ptBR }).toUpperCase();

  // Cores do modelo original
  const headerBg = '#D9E1F2'; // Azul claro do cabeçalho
  const borderColor = '#000000';

  return (
    <div 
      id="report-template"
      style={{ 
        boxSizing: 'border-box', 
        backgroundColor: '#ffffff', 
        color: '#000000',
        padding: '10mm 10mm',
        width: '210mm',
        minHeight: '297mm',
        fontFamily: '"Times New Roman", Times, serif',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Imagem de Fundo (Mar e Bússola) - Estilo Timbrado Original */}
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage: `url(${watermarkImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          opacity: 0.8,
        }}
      />

      <div style={{ position: 'relative', zIndex: 10 }}>
        <h1 style={{ 
          textAlign: 'center', 
          fontSize: '20px', 
          fontWeight: 'bold', 
          marginBottom: '15px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          PROYECTOS GSI, S.L
        </h1>

        {/* Cabeçalho de Identificação */}
        <div style={{ 
          display: 'flex', 
          fontSize: '11px', 
          fontWeight: 'bold',
          border: `1px solid ${borderColor}`,
          marginBottom: '-1px',
          backgroundColor: headerBg
        }}>
          <div style={{ 
            flex: 1, 
            borderRight: `1px solid ${borderColor}`, 
            padding: '4px 8px', 
            display: 'flex', 
            alignItems: 'center',
          }}>
            <span>Nombre:</span>
            <span style={{ marginLeft: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {userName} - {userRole.toUpperCase()}
            </span>
          </div>
          <div style={{ 
            width: '25%', 
            borderRight: `1px solid ${borderColor}`, 
            padding: '4px 8px', 
            display: 'flex', 
            alignItems: 'center',
          }}>
            <span>Mês:</span>
            <span style={{ marginLeft: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {monthName}
            </span>
          </div>
          <div style={{ 
            width: '20%', 
            padding: '4px 8px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            fontSize: '9px'
          }}>
            <span>Año: {year}</span>
            {entries.length > 0 && (
              <span style={{ fontSize: '8px', color: '#666' }}>Taxa: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalPayment / totalHours || 0)}/h</span>
            )}
          </div>
        </div>

        {/* Tabela de Horários */}
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontSize: '9px',
          border: `1px solid ${borderColor}`,
          backgroundColor: 'transparent'
        }}>
          <thead>
            <tr style={{ backgroundColor: headerBg }}>
              <th style={{ border: `1px solid ${borderColor}`, width: '30px', padding: '2px', textAlign: 'center' }}>DIA</th>
              <th style={{ border: `1px solid ${borderColor}`, width: '70px', padding: '2px', textAlign: 'center' }}>HORAS</th>
              <th style={{ border: `1px solid ${borderColor}`, width: '180px', padding: '4px 8px', textAlign: 'center' }}>OBRA</th>
              <th style={{ border: `1px solid ${borderColor}`, padding: '4px 8px', textAlign: 'center' }}>TRABAJOS EXERCIDOS</th>
            </tr>
          </thead>
          <tbody>
            {daysArray.map((day) => {
              const entry = getEntryForDay(day);
              const isInvalidDay = day > daysInMonth;
              const dateObj = new Date(year, month, day);
              const isSunday = !isInvalidDay && dateObj.getDay() === 0;
              
              return (
                <tr key={day} style={{ height: '20px', backgroundColor: 'transparent' }}>
                  <td style={{ 
                    border: `1px solid ${borderColor}`, 
                    textAlign: 'center', 
                    fontWeight: 'bold',
                    backgroundColor: headerBg,
                    width: '30px',
                    color: isSunday ? '#c00000' : 'inherit'
                  }}>
                    {day.toString().padStart(2, '0')}
                  </td>
                  <td style={{ 
                    border: `1px solid ${borderColor}`, 
                    textAlign: 'center', 
                    color: isSunday ? '#c00000' : (entry?.is_absence ? 'red' : 'inherit'), 
                    fontWeight: (isSunday || entry?.is_absence) ? 'bold' : 'normal' 
                  }}>
                    {!isInvalidDay && (isSunday ? 'DOMINGO' : (entry?.is_absence ? 'FALTA' : entry?.hours || ''))}
                  </td>
                  <td style={{ 
                    border: `1px solid ${borderColor}`, 
                    padding: '0 8px', 
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    color: isSunday ? '#c00000' : (entry?.is_absence ? 'red' : 'inherit'),
                    fontWeight: isSunday ? 'bold' : 'normal'
                  }}>
                    {!isInvalidDay && (isSunday ? 'DOMINGO' : (entry?.is_absence ? (entry.absence_reason || 'MOTIVO NÃO INFORMADO') : entry?.obra || ''))}
                  </td>
                  <td style={{ 
                    border: `1px solid ${borderColor}`, 
                    padding: '0 8px', 
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    color: isSunday ? '#c00000' : 'inherit',
                    fontWeight: isSunday ? 'bold' : 'normal'
                  }}>
                    {!isInvalidDay && (isSunday ? 'DOMINGO' : (entry ? (entry.is_absence ? 'FALTA JUSTIFICADA' : userRole.toUpperCase()) : ''))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: headerBg, fontWeight: 'bold' }}>
              <td style={{ border: `1px solid ${borderColor}`, padding: '8px 4px', textAlign: 'center', fontSize: '12px' }}>TOT</td>
              <td style={{ border: `1px solid ${borderColor}`, padding: '8px 4px', textAlign: 'center', fontSize: '14px' }}>
                {Number(totalHours || 0).toFixed(1)}H
              </td>
              <td colSpan={2} style={{ border: `1px solid ${borderColor}`, padding: '8px 20px', textAlign: 'right', fontSize: '14px' }}>
                TOTAL A RECEBER: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalPayment)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ReportTemplate;
