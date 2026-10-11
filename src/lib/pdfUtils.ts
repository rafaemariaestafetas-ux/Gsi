import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { shareContent } from './shareService';
import { triggerSuccessHaptic } from './haptics';

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const originalStyle = element.style.display;
    element.style.display = 'block';
    
    // Pequeno delay para renderização total
    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(element, {
      scale: 3, // Qualidade ultra-alta
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(filename);
    
    element.style.display = originalStyle;
    await triggerSuccessHaptic();

    // Se estiver no mobile, tenta oferecer o share nativo
    await shareContent({
      title: 'Relatório de Ponto GSI PRO',
      text: `Relatório de folha de ponto gerado: ${filename}`,
      dialogTitle: 'Partilhar Relatório de Ponto'
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};

export const exportToJPG = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const originalStyle = element.style.display;
    element.style.display = 'block';
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    
    const link = document.createElement('a');
    link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 1.0);
    link.click();
    
    element.style.display = originalStyle;
    await triggerSuccessHaptic();

    // Oferece partilha nativa
    await shareContent({
      title: 'Folha de Ponto GSI PRO',
      text: `Folha de ponto mensal gerada: ${filename}`,
      dialogTitle: 'Partilhar Folha de Ponto'
    });
  } catch (error) {
    console.error('Error generating JPG:', error);
  }
};
