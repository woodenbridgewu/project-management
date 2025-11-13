import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SearchService, SearchResult, SearchType } from '../../core/services/search.service';

@Component({
    selector: 'app-search-results',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './search-results.component.html',
    styleUrls: ['./search-results.component.css']
})
export class SearchResultsComponent implements OnInit {
    private searchService = inject(SearchService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    searchQuery = signal('');
    searchType = signal<SearchType>('all');
    searchResults = signal<SearchResult | null>(null);
    // 保存所有類型的總計數（從初始 'all' 搜尋中獲取）
    totalCounts = signal<{ tasks: number; projects: number; workspaces: number }>({
        tasks: 0,
        projects: 0,
        workspaces: 0
    });
    loading = signal(false);
    error = signal<string | null>(null);

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            const query = params['q'] || '';
            const type = (params['type'] || 'all') as SearchType;
            
            this.searchQuery.set(query);
            this.searchType.set(type);
            
            if (query.trim().length > 0) {
                this.performSearch(query, type);
            }
        });
    }

    performSearch(query: string, type: SearchType = 'all'): void {
        if (query.trim().length === 0) return;

        this.loading.set(true);
        this.error.set(null);

        // 如果是特定類型且還沒有總計數，先執行一次 'all' 搜尋來獲取總計數
        if (type !== 'all' && this.totalCounts().tasks === 0 && 
            this.totalCounts().projects === 0 && 
            this.totalCounts().workspaces === 0) {
            // 先獲取所有類型的計數
            this.searchService.search(query, 'all', 50, 0).subscribe({
                next: (allResults) => {
                    this.totalCounts.set({
                        tasks: allResults.tasks.length,
                        projects: allResults.projects.length,
                        workspaces: allResults.workspaces.length
                    });
                    // 然後執行特定類型的搜尋
                    this.executeSearch(query, type);
                },
                error: () => {
                    // 如果 'all' 搜尋失敗，直接執行特定類型搜尋
                    this.executeSearch(query, type);
                }
            });
        } else {
            // 直接執行搜尋
            this.executeSearch(query, type);
        }
    }

    private executeSearch(query: string, type: SearchType): void {
        this.searchService.search(query, type, 50, 0).subscribe({
            next: (results) => {
                // 如果是 'all' 類型搜尋，保存所有類型的總計數
                if (type === 'all') {
                    this.totalCounts.set({
                        tasks: results.tasks.length,
                        projects: results.projects.length,
                        workspaces: results.workspaces.length
                    });
                    this.searchResults.set(results);
                } else {
                    // 如果是特定類型搜尋，只更新該類型的結果，保留其他類型的結果
                    const currentResults = this.searchResults();
                    if (currentResults) {
                        // 合併結果：保留其他類型的結果，只更新當前類型
                        const mergedResults: SearchResult = {
                            tasks: type === 'tasks' ? results.tasks : (currentResults.tasks || []),
                            projects: type === 'projects' ? results.projects : (currentResults.projects || []),
                            workspaces: type === 'workspaces' ? results.workspaces : (currentResults.workspaces || []),
                            total: results.total
                        };
                        this.searchResults.set(mergedResults);
                    } else {
                        this.searchResults.set(results);
                    }
                }

                this.loading.set(false);
            },
            error: (err) => {
                console.error('Search error:', err);
                this.error.set('搜尋時發生錯誤，請稍後再試');
                this.loading.set(false);
            }
        });
    }

    onTypeChange(type: SearchType): void {
        this.searchType.set(type);
        const query = this.searchQuery();
        if (query.trim().length > 0) {
            this.performSearch(query, type);
            // 更新 URL
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { q: query, type },
                queryParamsHandling: 'merge'
            });
        }
    }

    getStatusLabel(status: string): string {
        const statusMap: { [key: string]: string } = {
            'todo': '待處理',
            'in_progress': '進行中',
            'review': '審核中',
            'done': '已完成'
        };
        return statusMap[status] || status;
    }

    getPriorityLabel(priority?: string): string {
        if (!priority) return '';
        const priorityMap: { [key: string]: string } = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'urgent': '緊急'
        };
        return priorityMap[priority] || priority;
    }

    getPriorityClass(priority?: string): string {
        if (!priority) return '';
        return `priority-${priority}`;
    }
}

