import axios from 'axios';
import { UserReport } from '@/types/report';
import authService from '@/services/authService'; // authServiceをインポートしてインターセプターを有効化

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ReportResponseWithAnalysis {
  needsAnalysis: true;
  existingData: UserReport | null;
  lastAnalyzedAt: string;
  message: string;
  messagesSinceAnalysis?: number;
}

interface ReportResponseWithoutAnalysis extends UserReport {
  needsAnalysis: false;
  lastAnalyzedAt: string;
}

type ReportResponse = ReportResponseWithAnalysis | ReportResponseWithoutAnalysis | UserReport;

class ReportService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` })
    };
  }

  /**
   * ユーザーのレポートデータを取得（分析必要性チェック付き）
   */
  async getReport(): Promise<ReportResponse> {
    const response = await axios.get(`${API_BASE_URL}/api/v1/report`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  /**
   * AI分析を手動実行
   */
  async executeAnalysis(): Promise<UserReport> {
    const response = await axios.post(`${API_BASE_URL}/api/v1/report/analyze`, {}, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  /**
   * 週次レポートデータを取得
   */
  async getWeeklyReport() {
    const response = await axios.get(`${API_BASE_URL}/api/v1/report/weekly`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  /**
   * 月次レポートデータを取得
   */
  async getMonthlyReport() {
    const response = await axios.get(`${API_BASE_URL}/api/v1/report/monthly`, {
      headers: this.getHeaders()
    });
    return response.data;
  }
}

const reportService = new ReportService();
export default reportService;